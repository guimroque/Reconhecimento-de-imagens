'use strict';

const axios = require('axios')
class Handler {
  constructor({rekoSvc, translatorSvc}) {
    this.rekoSvc = rekoSvc
    this.translatorSvc = translatorSvc
  }

  async detectImageLabels(buffer){
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise()
    
    const workingItems = result.Labels
                        .filter(({Confidence})=> Confidence > 99.5)
                        
    const names = workingItems
                  .map(({Name})=>Name)
                  .join(' and ')
    return {names, workingItems}
  } 

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }
    const {TranslatedText} = await this.translatorSvc
                            .translateText(params)
                            .promise()
    return TranslatedText.split(' e ')
  }

  formatTextResults(texts, workingItems){
    const finalText = []
    texts.map((e, i)=>{
      finalText.push(` ${workingItems[i].Confidence.toFixed(2)}% de ser do tipo ${texts[i]}`)
    })
    return finalText
  }

  async getImageBuffer(imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    })

    const buffer = new Buffer.from(response.data, 'base64')

    return buffer
  }

  async main(event){
    try{
      
      const { imageUrl } = event.queryStringParameters
      console.log('downloading image...')
      const imgBuffer = await this.getImageBuffer(imageUrl)
      const {names, workingItems} = await this.detectImageLabels(imgBuffer)
      
      const texts = await this.translateText(names)
      console.log('handling final object...')
      const finalText = this.formatTextResults(texts, workingItems)
      console.log('Finishing...')
      return {
        statusCode: 200,
        body: `A imagem tem ==> `.concat(finalText)
      }
    }catch(e){
      console.log('ERROR***: ', e.stack)
      return {
        statusCode: 500, 
        body: 'Internal server error'
      }
    }
  }
}



//factory
const aws = require('aws-sdk');
const reko = new aws.Rekognition()
const translator = new aws.Translate()
const handler = new Handler({
  rekoSvc : reko,
  translatorSvc : translator 
})

module.exports.main = handler.main.bind(handler)
