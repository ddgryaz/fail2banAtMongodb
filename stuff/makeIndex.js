const settings = require('../settings.js')
const dbConnector = new (require('MinimalMongodb'))(settings.dbSettings)
const banTime = settings.banTime || (60 * 60 * 12); // 12h

(async function () { // Can't use await at the top level
  const mdb = await dbConnector.connect()
   /*try{
    await mdb.createCollection('events', {
      capped: true,
      size: 100000
    })
  }catch(e){}*/
  /*try{
    await mdb.collection('unban').drop()
  }catch(e){} */

  await mdb.collection('ban').createIndex({ t: 1 }, {
    name: 't01',
    expireAfterSeconds: banTime
  })
  await mdb.collection('unban').createIndex({ t: 1 }, {
    name: 't02',
    expireAfterSeconds: banTime
  })
  await mdb.collection('ban').createIndex({ t: 1, serverName: 1 }, {
    name: 't03'
  })

  await mdb.collection('statistics').createIndex({ lastDate: 1 }, {
    expireAfterSeconds: (60 * 60 * 24 * 2)
  })

  await mdb.collection('statistics').createIndex({ cnt: 1 })

  await dbConnector.client.close()
})().then(() => {
//  server.close(()=>{
  console.log('Finish')
//  });
}).catch((err) => {
  console.log('Error', err)
})
