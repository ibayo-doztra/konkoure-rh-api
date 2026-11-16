'use strict'

/**
 * Couche d'adaptation @swc/core -> @swc/wasm.
 * @swc/wasm rejette les options valant `undefined` (ex. jsc.baseUrl envoyé
 * par @poppinss/ts-exec), contrairement au binaire natif : on les retire.
 */
const wasm = require('@swc/wasm')

function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) out[key] = clean(val)
    }
    return out
  }
  return value
}

exports.transform = (src, opts) => wasm.transform(src, clean(opts))
exports.transformSync = (src, opts) => wasm.transformSync(src, clean(opts))
exports.parse = (src, opts) => wasm.parse(src, clean(opts))
exports.parseSync = (src, opts) => wasm.parseSync(src, clean(opts))
exports.print = (program, opts) => wasm.print(program, clean(opts))
exports.printSync = (program, opts) => wasm.printSync(program, clean(opts))
exports.minify = (src, opts) => wasm.minify(src, clean(opts))
exports.minifySync = (src, opts) => wasm.minifySync(src, clean(opts))
