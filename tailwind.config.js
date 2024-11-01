const colors = require('tailwindcss/colors')
const { light, dark } = require('@charcoal-ui/theme')
const { createTailwindConfig } = require('@charcoal-ui/tailwind-config')
const { iconsPlugin, getIconCollections } = require('@egoist/tailwindcss-icons')

/**
 * @type {import('tailwindcss/tailwind-config').TailwindConfig}
 */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/components/**/*.{js,ts,jsx,tsx}',
    './src/renderer/**/*.html'
  ],
  presets: [
    createTailwindConfig({
      version: 'v3',
      theme: {
        ':root': light
      }
    })
  ],
  theme: {
    extend: {
      colors: {
        primary: '#856292',
        'primary-hover': '#8E76A1',
        'primary-press': '#988BB0',
        'primary-disabled': '#6F48694D',
        secondary: '#FF617F',
        'secondary-hover': '#FF849B',
        'secondary-press': '#FF9EB1',
        'secondary-disabled': '#FF617F4D',
        base: '#FBE2CA',
        'custom-text-primary': '#514062'
      },
      fontFamily: {
        M_PLUS_2: ['Montserrat', 'M_PLUS_2', 'sans-serif'],
        Montserrat: ['Montserrat', 'sans-serif']
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      },
      width: {
        '1/2': '50%'
      }
    }
  },
  plugins: [
    iconsPlugin({
      // Select the icon collections you want to use
      // You can also ignore this option to automatically discover all individual icon packages you have installed
      // If you install @iconify/json, you should explicitly specify the collections you want to use, like this:
      collections: getIconCollections(['mdi', 'lucide', 'material-symbols'])
      // If you want to use all icons from @iconify/json, you can do this:
      // collections: getIconCollections("all"),
      // and the more recommended way is to use `dynamicIconsPlugin`, see below.
    })
  ]
}
