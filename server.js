// Copyright (c) 2023 YA-androidapp(https://github.com/YA-androidapp) All rights reserved.


const path = require("path");
const fastify = require("fastify")({
  logger: false,
});

const fs = require('fs');
const https = require('https');
const jimp = require('jimp');


const colors = [
  { mmph: -1, r: 0, g: 0, b: 0, a: 0 },
  { mmph: -1, r: 255, g: 255, b: 255, a: 0 },
  { mmph: 0, r: 242, g: 242, b: 255, a: 255 },
  { mmph: 1, r: 160, g: 210, b: 255, a: 255 },
  { mmph: 5, r: 33, g: 140, b: 255, a: 255 },
  { mmph: 10, r: 0, g: 65, b: 255, a: 255 },
  { mmph: 20, r: 250, g: 245, b: 0, a: 255 },
  { mmph: 30, r: 255, g: 153, b: 0, a: 255 },
  { mmph: 50, r: 255, g: 40, b: 0, a: 255 },
  { mmph: 80, r: 180, g: 0, b: 104, a: 255 }
];
const L = (180 / Math.PI) * Math.asin(Math.tanh(Math.PI)); // 85.05112877980663
const NowcastURL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json';


const getMmph = (c) => {
  const color = colors.find(el => el.r == c.r && el.g == c.g && el.b == c.b && el.a == c.a);
  return color ? color.mmph : -2;
};


const getNowcastJson = () => {
  return new Promise((resolve, reject) => {
    https.get(NowcastURL, (res) => {
      let result = [];
      // console.log('statusCode', res.statusCode);
      // console.log('headers', res.headers);

      res.on('data', function (chunk) {
        result.push(chunk);
      }).on('end', function () {
        const jsonData = JSON.parse(Buffer.concat(result));
        const data = jsonData
          .map(({ basetime, validtime }) => ({ basetime: basetime, validtime: validtime }))
          .sort(function (a, b) {
            // validtimeの昇順
            return a.validtime - b.validtime;
          });

        resolve(data);
      });
    }).on('error', (e) => {
      console.error(e);
      reject(e.message);
    });
  });
};


const getTileUrl = (basetime, validtime, lat, lon, zoom) => {
  lat = parseFloat(lat);
  lon = parseFloat(lon);
  zoom = parseInt(zoom);

  const pixelX = parseInt(Math.pow(2, zoom + 7) * (lon / 180 + 1));
  const tileX = parseInt(pixelX / 256);
  const imageX = pixelX % 256;

  const pixelY = parseInt((Math.pow(2, zoom + 7) / Math.PI) * ((-1 * Math.atanh(Math.sin((Math.PI / 180) * lat))) + Math.atanh(Math.sin((Math.PI / 180) * L))));
  const tileY = parseInt(pixelY / 256);
  const imageY = pixelY % 256;

  const uri = `https://www.jma.go.jp/bosai/jmatile/data/nowc/${basetime}/none/${validtime}/surf/hrpns/${zoom}/${tileX}/${tileY}.png`;
  // console.log('uri', uri)
  return [uri, validtime, imageX, imageY]
};

const getTilePixel = async (uri, validtime, x, y) => {
  const image = await jimp.read(uri);
  // console.log(image.bitmap.width, image.bitmap.height);

  // const buffer = await image.getBufferAsync(jimp.MIME_PNG);
  // const datauri = 'data:image/png;base64,' + buffer.toString('base64');

  await image.crop(x, y, 1, 1);
  // console.log(image.bitmap.width, image.bitmap.height);

  const color = await jimp.intToRGBA(image.getPixelColor(0, 0));

  // const buffer = await image.getBufferAsync(jimp.MIME_PNG);
  // const datauri = 'data:image/png;base64,' + buffer.toString('base64');

  return {
    validtime: validtime,
    mmph: getMmph(color),
    color: color // ,
    // image: datauri
  }
};


fastify.get("/", async (request, reply) => {
  const lat = (request.query.lat && request.query.lon) ? request.query.lat : 35.681236;
  const long = (request.query.lat && request.query.lon) ? request.query.lon : 139.767125;
  const zoom = 10;

  getNowcastJson()
    .then(async json => {

      const items = await Promise.all(json.map(async item => {
        const [uri, vtime, imageX, imageY] = await getTileUrl(item.basetime, item.validtime, lat, long, zoom);
        return getTilePixel(uri, vtime, imageX, imageY);
      }))

      // console.log('items', items);
      reply.send({
        latitude: lat,
        longitude: long,
        // zoom: zoom,
        items: items
      })

    })
    .catch(e => {
      console.error(e);
    });

  reply.code(200)
    .header('Content-Type', 'application/json')
    .type('application/json')
  await reply
});


fastify.get('/version', (request, reply) => {
  reply
    .code(200)
    .header('Content-Type', 'application/json; charset=utf-8')
    .send({ version: '1.0.0' })
})


fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
