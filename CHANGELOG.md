# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.5] - 2026-04-29

### Added

- Add internal configuration for merge and schema creation strategies (open path for future configurable strict/strip/loose modes)
- Better alignment of slot type with `isSchemaType` guard pairing with internal `isZTRenderable`.

### Changed

- `zt.p` for scoped schema now returns an `IRenderable` instead of a `ZodPipe`, aligning it to the funcitonal api, now it composable like any other renderable.
- Renderable schemas are now computed at compile time and immutable after creation (no more mutable `schema` property [big win]).
- Shape merging across nested templates uses a centralised `mergeShapes` with configurable strategy (default `intersect`).

### Fixed

- Minor type improvements in internal operator signatures.

## [0.0.4] - 2026-04-27

### Added

- `zt.bind` for karg binding / renderable collapse
- `zt.map` for transformations and operations on arrays
- `zt.match` for pattern matching (powered by discriminatedUnion)
- `zt.opaque` workaround to opt out to output tuple inference if ts 
- `zt.empty` identity constant
- Some slop tests for functional properties and snapshot output to '.snapshot.txt'
- Core abstraction for scope and schema
- Updates readme with sections on slop examples, functional approach and better API documentation. 

### Fixed

- Few adjustments on `unknown[]` and other type smells on operators typings

## [0.0.3] - 2026-04-25

### Added

- Static flattening/precompilation of known nested renderable structures as definition time
- Few immutability guards, now IRenderable itself and its strs, vals private attributes are frozen at creation
- Scope context added to InterpolationError traces
- Simple black box suite for slop tests

### Changes

- Foundamental internal changes on renderable interface and implementation design


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