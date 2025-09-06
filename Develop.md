# Developing Tips

## For SCSS Compiling

```bash
npx sass --watch --no-source-map --style=compressed assets/scss/main.scss assets/styles.min.css
```

## For JS Minifying

```bash
npx terser  assets/script.js -o assets/script.min.js --compress --mangle --watch
```
