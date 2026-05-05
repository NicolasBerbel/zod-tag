# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Strict mode for zt.z: `zt.z.strict`, `zt.z.strip` schema strategies complementing default loose strategy
    - **Important limitation**: new kargs that are inserted by dynamic evaluated holes (selectors and schemas) are not collected into strict parent schemas at compile time, this means strict and strip modes have limitations over free composability.
    - use `zt.p` to scope strict/strip mode schemas and renderables 
    - prefer `strict` and `strip` at leaf renderables that you can scope with `zt.p` or top level renderables with previously known final schemas.
- Tests covering strict/strip/loose modes edge cases
- `zt.empty` singleton for stable reference on empty renderable without schema (zt.t`` === zt.empty)
- Dedicated paths for static structural renderables without schemas
- New public API's:
    - `renderable.stream(kargs)`: returns a generator that yields `ZtChunk`'s
    - `zt.collect(stream)`: collects a `Generator<ZtChunk>` into a immutable [string[], ...values] tuple

### Changed

- Renamed 'cli' tests directory for more aligned 'playground'
- Refactor of the interpolation engine from array splice to generator
- Refactor of the compilation pipeline from array splice to generator
- `zt.map` over large lists (> 250 length) switches to lazy evaluation of bound renderarables at render time, lists <= 250 length didn't change.

### Fixed

- Output tuple type definitions for `zt.match`:
    - note: union type explosion is under better control for complex branching with pattern match
    - note 2: feature-flags slop test doesn't need `zt.opaque` anymore
- Separators at `zt.join` and `zt.map` now dont duplicate when lists return `zt.empty`
- Fixed `zt.p` loss of schema transforms for scoped inline object schemas
- Enhanced performance of `zt.join` given the high recursive nature of the reducer pattern

## [0.0.7] - 2026-05-01

### Added

- Added type tests for algebra-properties (ensure types pair with implementation)

### Changed

- Refactor of the scoping mechanism - now it tracks the full scope path not only a keyword

### Fixed

- `zt.match` inside `zt.p` now works without workarounds
- `zt.p` and `zt.map` out renderable inference
- Wrong NPC dialog slop test assertions

## [0.0.6] - 2026-04-30

### Added

- Added unit tests for interpolation, composition and pattern-matching
- Added unit tests for algebraic-properties, performance and memory
- Added type tests for core inference (sanity checks)
- `zt.join` overload for correct type inference in combine operation of renderables
- `zt.if` overload for correct type inference in conditional identity operation of renderables

### Changed

- The output tuple `[strs[], ...vals]` of `renderer.render()` is now immutable (both: the tuple and the strings array)
- Removed nested `while(true)` loop from `compile` and `interpolate`
- Refactor on `ExtractKargs` and `ExtractOutput` to use tail recursive patterns

### Fixed

- Regression on `zt.match` given 'strict' inner discriminated union shape
- Better type inference for `zt.map` and `zt.join`

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