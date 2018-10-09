/* eslint-disable no-param-reassign */

const { Command, flags: flagtypes } = require('@heroku-cli/command');
const cli = require('heroku-cli-util');
const json2csv = require('json2csv');
const { color } = require('@heroku-cli/color');

const sum = collection => (
  collection.reduce((total, current) => total + current, 0)
);

const sequence = collection => collection.join('\n');

const price = dollars => (
  dollars.toLocaleString('en', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  })
);

const BUILDPACK_DYNO_TYPES = ['console', 'rake'];

class BillingCommand extends Command {
  async fetch(path) {
    const response = await this.heroku.get(path);
    return response.body;
  }

  async run() {
    const { flags } = this.parse(BillingCommand);

    const dynoSizesByName = {};
    (await this.fetch('/dyno-sizes')).forEach((dynoSize) => {
      dynoSizesByName[dynoSize.name] = dynoSize;

      // Sets dyno units correctly for Free / Hobby dyno sizes
      dynoSize.dyno_units = dynoSize.dyno_units || 1;
    });

    let apps = null;
    if (flags.team) {
      apps = await this.fetch(`/teams/${flags.team}/apps`);
    } else if (flags.personal) {
      apps = await this.fetch('/users/~/apps');
    } else if (flags.app) {
      apps = [await this.fetch(`/apps/${flags.app}`)];
    } else {
      apps = await this.fetch('/apps');
    }

    const overview = await Promise.all(
      apps.map(async (app) => {
        const addons = (await this.fetch(`/apps/${app.name}/addons`))
          .map((addon) => {
            if (addon.billed_price.unit !== 'month') {
              throw new Error('Non-monthly bill price for add-on');
            }

            addon.shared = addon.billing_entity.id !== app.id;
            addon.price = addon.billed_price.cents / 100;
            return addon;
          });

        const dynos = (await this.fetch(`/apps/${app.name}/formation`))
          .filter(dyno => (
            !BUILDPACK_DYNO_TYPES.includes(dyno.type) || dyno.quantity > 0
          ))
          .map((dyno) => {
            dyno.size = dynoSizesByName[dyno.size];
            if (!dyno.size) {
              throw new Error('Missing dyno size');
            }

            dyno.price = dyno.quantity * dyno.size.cost.cents / 100;
            return dyno;
          });

        app.dyno_count = sum(dynos.map(dyno => dyno.quantity * dyno.size.dyno_units));

        const billing = {
          // Shared addons are billed to the owning app
          addon_cost: sum(addons.map(addon => (addon.shared ? 0 : addon.price))),
          dyno_cost: sum(dynos.map(dyno => dyno.price)),
        };
        billing.total_cost = billing.addon_cost + billing.dyno_cost;

        return {
          app,
          addons,
          dynos,
          billing,
        };
      }),
    );

    const totals = {
      dyno_count: sum(overview.map(entry => entry.app.dyno_count)),
      dyno_cost: sum(overview.map(entry => entry.billing.dyno_cost)),
      addon_cost: sum(overview.map(entry => entry.billing.addon_cost)),
    };
    totals.total_cost = totals.dyno_cost + totals.addon_cost;

    if (flags.json) {
      cli.styledJSON({ overview, totals });
      return;
    }

    const data = overview.map(entry => ({
      name: entry.app.name,
      owner: entry.app.owner.email,
      dyno_count: entry.app.dyno_count,
      dynos: entry.dynos,
      addons: entry.addons,
      ...entry.billing,
    }));

    // Virtual record for totals at the bottom of the overview
    if (data.length > 1) {
      data.push({
        name: null,
        owner: null,
        dyno_count: totals.dyno_count,
        dynos: [],
        addons: [],
        dyno_cost: totals.dyno_cost,
        addon_cost: totals.addon_cost,
        total_cost: totals.total_cost,
      });
    }

    const priceFormatter = (format, value) => (
      format === 'table' ? price(value) : value
    );

    const fields = [
      {
        key: 'name',
        label: 'App',
        formatter: (format, name) => {
          if (!name) return '';
          if (format === 'table') return color.app(name);
          return name;
        },
      },
      {
        key: 'owner',
        label: 'Owner',
        formatter: (format, owner) => owner || '',
      },
      {
        key: 'dyno_count',
        label: 'Dyno count',
        formatter: (format, count) => {
          if (format === 'table') {
            return count > 0 ? color.green(count) : color.red(count);
          }
          return count;
        },
      },
      {
        key: 'dynos',
        label: 'Dynos',
        formatter: (format, dynos) => sequence(dynos.map((dyno) => {
          const label = `${dyno.type}: ${dyno.quantity}x ${dyno.size.name} – ${price(dyno.price)}`;
          if (format === 'table' && dyno.quantity < 1) {
            return color.gray(label);
          }
          return label;
        })),
      },
      {
        key: 'addons',
        label: 'Add-ons',
        formatter: (format, addons) => sequence(addons.map((addon) => {
          const label = `${addon.plan.name} – ${price(addon.price)}`;
          if (format === 'table' && addon.shared) {
            return color.gray(label);
          }
          return label;
        })),
      },
      {
        key: 'dyno_cost',
        label: 'Dyno costs',
        formatter: priceFormatter,
      },
      {
        key: 'addon_cost',
        label: 'Add-on costs',
        formatter: priceFormatter,
      },
      {
        key: 'total_cost',
        label: 'Total costs',
        formatter: priceFormatter,
      },
    ];

    if (flags.csv) {
      const csv = json2csv.parse(data, {
        fields: fields.map(field => ({
          label: field.label,
          value: (entry) => {
            const value = entry[field.key];
            return field.formatter('csv', value);
          },
        })),
      });
      process.stdout.write(csv);
      return;
    }

    cli.log();
    cli.table(data, {
      columns: fields.map(field => (
        {
          key: field.key,
          label: field.label,
          format: field.formatter.bind(null, 'table'),
        }
      )),
    });
    cli.log();
  }
}

BillingCommand.description = `
  generates a billing overview including dyno and add-on costs per application
`;

BillingCommand.flags = {
  app: flagtypes.app(),
  csv: flagtypes.boolean({
    description: 'return billing overview in csv format',
    exclusive: ['json'],
  }),
  json: flagtypes.boolean({
    description: 'return billing overview in json format',
    exclusive: ['csv'],
  }),
  personal: flagtypes.boolean({
    description: 'only list personal apps',
    exclusive: ['app', 'team'],
  }),
  remote: flagtypes.remote(),
  team: flagtypes.string({
    description: 'only list apps in given team',
    exclusive: ['app', 'personal'],
  }),
};

module.exports = BillingCommand;
