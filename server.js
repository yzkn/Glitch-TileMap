// Copyright (c) 2023 YA-androidapp(https://github.com/YA-androidapp) All rights reserved. 


const path = require("path");
const fastify = require("fastify")({
  logger: false,
});

const req = require('request');
const fs = require('fs');

const jimp = require('jimp');
 

const L = 85.05112878; // 最大緯度
const getTileUrl = (lat, lon, zoom) => {
  lat  = parseFloat(lat);
  lon  = parseFloat(lon);
  zoom = parseInt(zoom);

  const pixelX = parseInt(Math.pow(2, zoom + 7) * (lon / 180 + 1));
  const tileX  = parseInt(pixelX / 256);
  const imageX = pixelX % 256;

  const pixelY = parseInt((Math.pow(2, zoom + 7) / Math.PI) * ((-1 * Math.atanh(Math.sin((Math.PI / 180) * lat))) + Math.atanh(Math.sin((Math.PI / 180) * L))));
  const tileY  = parseInt(pixelY / 256);
  const imageY = pixelY % 256;

  const uri = `https://cyberjapandata.gsi.go.jp/xyz/std/${zoom}/${tileX}/${tileY}.png`;
  // console.log('uri', uri)
  return [uri, imageX, imageY]
};


fastify.get("/", async (request, reply) => {
  const lat = request.query.lat ? request.query.lat : 35.681236;
  const long = request.query.long ? request.query.long : 139.767125;
  const zoom = request.query.zoom ? request.query.zoom : 10;

  const [uri, imageX, imageY] = getTileUrl(lat, long, zoom)
  const image = await jimp.read(uri);
  console.log(image.bitmap.width, image.bitmap.height);
  
  await image.crop( imageX, imageY, 1, 1 );
  console.log(image.bitmap.width, image.bitmap.height);
  
  const color = await jimp.intToRGBA(image.getPixelColor(0,0));
    
  const buffer = await image.getBufferAsync(jimp.MIME_PNG);
  console.log('buffer', buffer);
  const datauri = 'data:image/png;base64,' + buffer.toString('base64');
  
  reply.code(200)
    .header('Content-Type', 'application/json')
    .type('application/json')
  return {color: color, image: datauri}
});

fastify.get("/img", (request, reply) => {
  const lat = request.query.lat ? request.query.lat : 35.681236;
  const long = request.query.long ? request.query.long : 139.767125;
  const zoom = request.query.zoom ? request.query.zoom : 10;

  req({
    url: getTileUrl(lat, long, zoom)[0],
    encoding: null
  }, (err, res, body)=>{
    // console.log('body', body)
        
    reply.code(200)
      .header('Content-Type', 'image/png')
      .type('image/png')
      .send(body)
  })
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