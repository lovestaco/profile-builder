.PHONY: bump build release install

install:
	npm install

bump:
	@node -e " \
		const fs = require('fs'); \
		const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8')); \
		const [a, b, c] = m.version.split('.').map(Number); \
		m.version = a + '.' + b + '.' + (c + 1); \
		fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n'); \
		console.log('Version bumped to ' + m.version); \
	"

build:
	npm run build

release: bump build
	@echo "Done. Load extension/dist/ in Chrome."
