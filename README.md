# Heroku Billing

[![Version](https://img.shields.io/npm/v/@hyperoslo/heroku-billing.svg)](https://npmjs.org/package/@hyperoslo/heroku-billing)
[![License](https://img.shields.io/npm/l/@hyperoslo/heroku-billing.svg)](https://github.com/hyperoslo/heroku-billing/blob/master/package.json)

Generates a billing overview including dyno and add-on costs per application.

**Supported Node versions: 8 or higher**

Licensed under the **MIT** license, see [LICENSE] for more information.

![Heroku Billing](https://user-images.githubusercontent.com/378235/46540706-647a2980-c8ba-11e8-80c5-9d4f404c04fb.png)

## Installation

This is a Heroku client plugin and requires the [Heroku CLI] to be installed.

Install `heroku-billing` as a plugin from [npm]:

```shell
heroku plugins:install @hyperoslo/heroku-billing
```

## Usage

### Scope

By default, the generated billing overview includes all applications.

```shell
heroku billing
```

Personal applications *only*:

```shell
heroku billing --personal
```

Team applications *only*:

```shell
heroku billing --team hyperoslo
```

A single application:

```shell
heroku billing -a hyper-rocks
heroku billing -r production
```

Filter applications matching given pattern:

```shell
heroku billing --pattern foobar
```

### Inactive dynos & shared add-ons

Inactive dynos – fully scaled down processes – are not included in the overview
by default as they generate a lot of clutter.

To include all inactive dynos, shown in gray:

```shell
heroku billing --include-inactive-dynos
```

Add-ons shared between applications are always shown in gray.

### Formats

By default, the generated billing overview uses Heroku's human-readable table
format.

Generate the billing overview in JSON format:

```shell
heroku billing --json
```

Generate the billing overview in CSV format:

```shell
heroku billing --csv
```

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create pull request

## Credits

Hyper made this. We're a digital communications agency with a passion for good code,
and if you're using this plugin we probably want to hire you.

[Heroku CLI]: https://devcenter.heroku.com/articles/heroku-cli
[LICENSE]: LICENSE
[npm]: https://www.npmjs.com/package/@hyperoslo/heroku-billing
