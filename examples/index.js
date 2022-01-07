/* 
const projection = "EPSG:3576"
const extent = [-4859377.085, -7109342.085, 5159377.085, 2909412.085];

proj4.defs(
    projection,
    "+proj=laea +lat_0=90 +lon_0=90 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
);

register(proj4); */

const startResolution = 19567.87923828125;
const resolutions = [];
for (let i = 0; i < 12; i++) {
    resolutions.push(startResolution / Math.pow(2, i));
}


console.log(L.Proj);

var crs = new L.Proj.CRS('EPSG:3576',
    '+proj=laea +lat_0=90 +lon_0=90 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
    {
        resolutions,
        origin: [-4859377.085, -7109342.085],
        bounds: L.bounds([-4859377.085, -7109342.085], [5159377.085, 2909412.085])
    })




var map = L.map('map', {
    crs: crs,
    continuousWorld: true,
    worldCopyJump: false,
}).setView([55, 90], 2);
L.tileLayer('http://monitor.krasn.ru/tiles/sentinel2016/{z}/{x}/{-y}.jpeg').addTo(map);

const DOT_SIZE = 20
const DOT_DENSITY = 8

const HexRegExp = /^#([0-9a-fA-F]{3,6})$/
const RgbRegExp = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/


const hexToArray = (str) => {
    if (str.length === 4) {
        return [
            parseInt(str[1] + str[1], 16),
            parseInt(str[2] + str[2], 16),
            parseInt(str[3] + str[3], 16)
        ]
    } else if (str.length === 7) {
        return [
            parseInt(str[1] + str[2], 16),
            parseInt(str[3] + str[4], 16),
            parseInt(str[5] + str[6], 16)
        ]
    } else {
        throw Error('invalid hex color, use #fff or #ffffff')
    }
}
const rgbToArray = (str) => {
    const match = str.match(RgbRegExp)
    return [+match[1] % 255, +match[2] % 255, +match[3] % 255]
}
const convertSchema = (schema) => {
    return schema.map(([value, color]) => {
        if (color.search(HexRegExp) != -1) {
            return [value, hexToArray(color)]
        } else if (color.search(RgbRegExp) != -1) {
            return [value, rgbToArray(color)]
        } else {
            throw Error('invalid schema color, use #ffffff or rgb(255, 255, 255)')
        }
    })
}
const getRange = (value, schema) => {
    if (value < schema[0][0]) {
        return schema[0][1]
    }
    for (let i = 1; i < schema.length; i++) {
        if (value < schema[i][0]) {
            return [schema[i - 1], schema[i]]
        }
    }
    return schema[schema.length - 1][1]
}
const normalizeValue = (value, min, max) => (value - min) / (max - min)
const interpolate = (value, left, right) => Math.round(left + (right - left) * value);
const getRgb = (value, left, right) => `rgb(${interpolate(value, left[0], right[0])},${interpolate(value, left[1], right[1])},${interpolate(value, left[2], right[2])})`
const colorScale = (schema) => {
    const convertedSchema = convertSchema(schema);
    return (value) => {
        const range = getRange(value, convertedSchema)
        if (range.length === 3) {
            return `rgb(${range[0]},${range[1]},${range[2]})`
        }

        return getRgb(
            normalizeValue(value, range[0][0], range[1][0]),
            range[0][1],
            range[1][1]
        );
    }
}

const to255 = (value) => (value - -100) * 255 / (70 - -100)
const colorSchema = [
    [to255(-40), '#810f7c'],
    [to255(-30), '#08519c'],
    [to255(-20), '#08519c'],
    [to255(-10), '#2171b5'],
    [to255(-5), '#14D100'],
    [to255(0), '#62E200'],
    [to255(5), '#FFFF00'],
    [to255(10), '#addd8e'],
    [to255(15), '#fed976'],
    [to255(20), '#feb24c'],
    [to255(30), '#fd8d3c'],
    [to255(40), '#e31a1c'],
    [to255(50), '#800026'],
]

const colors = colorScale(colorSchema)


let tile;
let imageArray;

const img = new Image()
img.onload = () => {
    const canvasPic = document.createElement("canvas");
    const ctxPic = canvasPic.getContext("2d");
    canvasPic.width = img.width;
    canvasPic.height = img.height;

    ctxPic.drawImage(img, 0, 0);
    const imageData = ctxPic.getImageData(0, 0, img.width, img.height).data;
    canvasPic.style.display = "none";

    imageArray = new Uint8Array(imageData.length / 4);
    for (let i = 0; i < imageData.length; i += 4) {
        imageArray[i / 4] = imageData[i];
    }


    const dataBbox = [19, 41, -168, 82]
    const part = Math.round(img.width / Math.abs(dataBbox[2] - dataBbox[0]))

    const getBboxConditionFunc = () => {
        if (dataBbox[2] < dataBbox[0]) {
            return (lon, lat) =>
                (lon >= dataBbox[0] && lat >= dataBbox[1] && lat <= dataBbox[3]) ||
                (lon >= -180 && lon <= dataBbox[2] && lat >= dataBbox[1] && lat <= dataBbox[3])
        }
        return (lon, lat) => lon >= dataBbox[0] && lon <= dataBbox[2] && lat >= dataBbox[1] && lat <= dataBbox[3]
    }


    if (!tile) {


        Uint8Array.prototype.getValue = function (lon, lat) {
            const x = lat;
            const y = dataBbox[2] < dataBbox[0] && lon <= dataBbox[2] ? lon + 360 : lon;

            const x1 = Math.floor(x * part) / part
            const x2 = x % (1 / part) === 0 ? x + 1 / part : Math.ceil(x * part) / part
            const y1 = Math.floor(y * part) / part
            const y2 = y % (1 / part) === 0 ? y + 1 / part : Math.ceil(y * part) / part



            const q11 = this[(dataBbox[3] - x1) * part * img.width + (y1 - dataBbox[0]) * part];
            const q12 = this[(dataBbox[3] - x1) * part * img.width + (y2 - dataBbox[0]) * part];
            const q21 = this[(dataBbox[3] - x2) * part * img.width + (y1 - dataBbox[0]) * part];
            const q22 = this[(dataBbox[3] - x2) * part * img.width + (y2 - dataBbox[0]) * part];


            const d = ((x2 - x1) * (y2 - y1))

            if (!d) {
                console.log(x1, x2, y1, y2);
            }
            return ((q11 * (x2 - x) * (y2 - y)) / d) + ((q21 * (x - x1) * (y2 - y)) / d) + ((q12 * (x2 - x) * (y - y1)) / d) + ((q22 * (x - x1) * (y - y1)) / d)
        }

        const bboxConditionFunc = getBboxConditionFunc()


        var CanvasLayer = L.GridLayer.extend({
            createTile: function (coords) {

                const tile = L.DomUtil.create('canvas', 'leaflet-tile')
                const ctx = tile.getContext('2d')
                const size = this.getTileSize()

                tile.width = size.x
                tile.height = size.y


                const nw = coords.scaleBy(size)
                const se = nw.add(size)
                const compression = 4;
                const half = compression / 2
                for (let y = nw.y, i = 0; y <= se.y; y += compression, i += compression) {
                    for (let x = nw.x, j = 0; x <= se.x; x += compression, j += compression) {
                        const latlng = map.unproject([x + half, y + half], coords.z)
                        if (bboxConditionFunc(latlng.lng, latlng.lat)) {
                            const value = imageArray.getValue(latlng.lng, latlng.lat)

                            ctx.fillStyle = colors(value);
                            ctx.fillRect(
                                j,
                                i,
                                compression,
                                compression
                            );
                        }

                    }
                }

                return tile;
            },
            redrawTile: function (coords, canvas) {

                console.log('redraw');

                const ctx = canvas.getContext('2d')
                const size = this.getTileSize()

                canvas.width = size.x
                canvas.height = size.y

                const nw = coords.scaleBy(size)
                const se = nw.add(size)
                const compression = 4;
                const half = compression / 2
                for (let y = nw.y, i = 0; y <= se.y; y += compression, i += compression) {
                    for (let x = nw.x, j = 0; x <= se.x; x += compression, j += compression) {
                        const latlng = map.unproject([x, y], coords.z)

                        const value = imageArray.getValue(latlng.lng, latlng.lat)

                        ctx.fillStyle = colors(value);
                        ctx.fillRect(
                            j - half,
                            i - half,
                            compression,
                            compression
                        );
                    }
                }
            }
        })

        tile = new CanvasLayer({ opacity: 0.7 }).addTo(map)

    } else {


        const keys = Object.keys(tile._tiles);
        // console.log(tile._tiles[keys[0]]);

        const coords = tile._tiles[keys[0]].coords;

        // console.log(tile._tiles[keys[0]].coords);
        // tile._removeTile(keys[0])

        /*    var lastTime = 0;
   
           function timeoutDefer(fn) {
               var time = +new Date(),
                   timeToCall = Math.max(0, 16 - (time - lastTime));
   
               lastTime = time + timeToCall;
               return window.setTimeout(fn, timeToCall);
           }
   
           function getPrefixed(name) {
               return window['webkit' + name] || window['moz' + name] || window['ms' + name];
           }
   
           var requestFn = window.requestAnimationFrame || getPrefixed('RequestAnimationFrame') || timeoutDefer; */



        const add = (coords, container) => {
            var tilePos = tile._getTilePos(coords),
                key = tile._tileCoordsToKey(coords);

            var computedTile = tile.createTile(tile._wrapCoords(coords), L.Util.bind(tile._tileReady, tile, coords));


            tile._initTile(computedTile);

            // if createTile is defined with a second argument ("done" callback),
            // we know that tile is async and will be ready later; otherwise
            if (tile.createTile.length < 2) {
                // mark tile as ready, but delay one frame for opacity animation to happen
                L.Util.requestAnimFrame(L.bind(tile._tileReady, tile, coords, null, computedTile));
            }

            L.DomUtil.setPosition(computedTile, tilePos);

            // tile._removeTile(keys[0])

            // save tile in cache
            tile._tiles[key] = {
                el: computedTile,
                coords: coords,
                current: true
            };

            container.appendChild(computedTile);
            // @event tileloadstart: TileEvent
            // Fired when a tile is requested and starts loading.
            tile.fire('tileloadstart', {
                tile: computedTile,
                coords: coords
            });
        }



        // tile._addTile(coords, tile._container)

        // console.log(tile._container.children[0]);


        Object.keys(tile._tiles).forEach(key => {

            tile.redrawTile(tile._tiles[key].coords, tile._tiles[key].el)

            /*   const el = tile._tiles[key].el
  
  
              add(tile._tiles[key].coords, tile._container.children[0])
  
              setTimeout(() => {
                  tile._container.children[0].removeChild(el);
              }, 200);
   */
        })



    }
}



const temp = () => {
    // img.src = 'https://www.ventusky.com/data/2022/01/05/icon/whole_world/hour_17/icon_teplota_2_m_20220105_17.jpg?1642032'
    // img.src = '/examples/temp.jpg'
    img.src = 'http://gis.krasn.ru/agro-gfs/202111/01/2021110118_temp_surface.jpg'
    img.crossOrigin = "anonymous";
}

const press = () => {
    img.src = 'https://www.ventusky.com/data/2022/01/05/icon/whole_world/hour_17/icon_tlak_20220105_17.jpg?1642032'
    img.crossOrigin = "anonymous";
}