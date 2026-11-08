export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    try {
      return await nextResolve(specifier, context)
    } catch (error) {
      if (error && error.code === 'ERR_MODULE_NOT_FOUND' && !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw error
    }
  }
  return nextResolve(specifier, context)
}
