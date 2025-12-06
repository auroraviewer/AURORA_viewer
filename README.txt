mamba install conda-forge::flask
cd ./frontend
npm install
npm run dev

## Tile image
mamba install conda-forge::libvips
vips dzsave he.tiff output --tile-size=512 --overlap=1 --suffix='.jpg[Q=90]'