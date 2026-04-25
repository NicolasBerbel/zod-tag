# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-04-24

### Added

- Added readme section with structure/value fine control at point of use insight
- Added template utilities `zt.join` and `zt.if`
- New slop examples of usage (one with sqlite)
- Support to scoped composition with `zt.p` function overload, second parameter accepts renderable
- Support to array as primitives, in fact anything not selector, schema or renderable is a 'primitive value' returned in the output tuple;.

### Updated

- Updated `zt.unsafe` to require a schema with primitive output

### Removed

- Droped `zt.param`, `zt.template` and `zt.zod` aliases for brevity, stick with `zt.p`, `zt.t`, `zt.z` core api.
- Removed variadic schemas support

## [0.0.1] - 2026-04-23

### Added

- Initial API design implementation