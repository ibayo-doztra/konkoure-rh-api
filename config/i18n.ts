import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, formatters, loaders } from '@adonisjs/i18n'

/**
 * French by default, English available (docs/backend/00 §4).
 * Language files: resources/lang/{fr,en}/*.json
 */
const i18nConfig = defineConfig({
  defaultLocale: env.get('DEFAULT_LOCALE', 'fr'),
  supportedLocales: ['fr', 'en'],
  formatter: formatters.icu(),

  loaders: [
    loaders.fs({
      location: app.languageFilesPath(),
    }),
  ],
})

export default i18nConfig
