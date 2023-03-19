require('dotenv').config() // for importing parameters

const telegramBotId = process.env.TELEGRAM_BOT_ID
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
const telegramChatId = process.env.TELEGRAM_CHAT_ID

const US_DIRECTION = 'U => S'
const SU_DIRECTION = 'S => U'

function getReserveWETH(web3, reserves) {
  if (Number(web3.utils.fromWei(reserves[0].toString(), 'ether') < Number(web3.utils.fromWei(reserves[1].toString(), 'ether')))) {
    return reserves[0] // WETH
  } else {
    return reserves[1] // WETH
  }
}

function getReserveShiba(web3, reserves) {
  if (Number(web3.utils.fromWei(reserves[0].toString(), 'ether') < Number(web3.utils.fromWei(reserves[1].toString(), 'ether')))) {
    return reserves[1] // SHIBA
  } else {
    return reserves[0] // SHIBA
  }
}

function sendFoundMessage(axios, startOnUniswap, addrTokenName, addressTokenContract, difference, amountIn, gasPrice, gasCost, gasCostUSD, shibaDifferenceUSD, profit) {
  let tradeMessage = '<b><pre>!!!SUCCESSFULL TRADE!!!</pre></b>%0A';

  if (startOnUniswap) {
    tradeMessage = tradeMessage + ' <pre>UniSwap -> SushiSwap</pre>%0A';
  } else {
    tradeMessage = tradeMessage + ' <pre>SushiSwap -> UniSwap</pre>%0A';
  }

  tradeMessage = tradeMessage + '<pre>WETH - ' + addrTokenName + '</pre>%0A'

  tradeMessage = tradeMessage + '<pre>Token Contract: ' + addressTokenContract + '</pre>%0A'

  tradeMessage = tradeMessage + '<pre>Amount In: ' + amountIn + '</pre>%0A'

  tradeMessage = tradeMessage + '<pre>Difference: ' + difference + '</pre>%0A'

  tradeMessage = tradeMessage + '<pre>Difference USD: ' + shibaDifferenceUSD + '</pre>%0A'

  tradeMessage = tradeMessage + '<pre>Gas Price: ' + gasPrice + '</pre>%0A'

  tradeMessage = tradeMessage + '<pre>Gas Cost: ' + gasCost + '</pre>%0A'

  tradeMessage = tradeMessage + '<pre>Gas Cost USD: ' + gasCostUSD + '</pre>%0A'

  tradeMessage = tradeMessage + '<b><pre>Profit USD: ' + profit + '</pre></b>'

  axios.get('https://api.telegram.org/bot' + telegramBotId + ':' + telegramBotToken + '/sendMessage?chat_id=' + telegramChatId + '&parse_mode=html&text=' + tradeMessage)
  .then(res => {
  })
  .catch(err => {
    console.log('Telegram error: ', err.message);
  })
}

function sendArbitrageMessage(axios, web3, startOnUniswap, ethBalanceAfter, addrTokenName, profit) {
  let tradeMessage = '<b><pre>!!!SUCCESSFULL ARBITRAGE!!!</pre></b>%0A'

  if (startOnUniswap) {
    tradeMessage = tradeMessage + ' <pre>UniSwap -> SushiSwap</pre>%0A'
  } else {
    tradeMessage = tradeMessage + ' <pre>SushiSwap -> UniSwap</pre>%0A'
  }

  tradeMessage = tradeMessage + '<pre>WETH - ' + addrTokenName + '</pre>%0A'

  tradeMessage = tradeMessage + '<b><pre>Profit USD: ' + profit + '</pre></b>%0A'

  tradeMessage = tradeMessage + '<b><pre>ETH Balance After: ' + Number(web3.utils.fromWei(ethBalanceAfter.toString(), 'ether')) + '</pre></b>'

  axios.get('https://api.telegram.org/bot' + telegramBotId + ':' + telegramBotToken + '/sendMessage?chat_id=' + telegramChatId + '&parse_mode=html&text=' + tradeMessage)
  .then(res => {
  })
  .catch(err => {
    console.log('Telegram error: ', err.message);
  })
}

function sendArbitrageErrorMessage(axios, web3, startOnUniswap, ethBalanceAfter, addrTokenName, profit) {
  let tradeMessage = '<b><pre>!!!ARBITRAGE ERROR!!!</pre></b>'

  if (startOnUniswap) {
    tradeMessage = tradeMessage + ' <pre>UniSwap -> SushiSwap</pre>%0A'
  } else {
    tradeMessage = tradeMessage + ' <pre>SushiSwap -> UniSwap</pre>%0A'
  }

  tradeMessage = tradeMessage + '<pre>WETH - ' + addrTokenName + '</pre>%0A'

  tradeMessage = tradeMessage + '<b><pre>Profit USD: ' + profit + '</pre></b>%0A'

  tradeMessage = tradeMessage + '<b><pre>ETH Balance After: ' + Number(web3.utils.fromWei(ethBalanceAfter.toString(), 'ether')) + '</pre></b>'

  axios.get('https://api.telegram.org/bot' + telegramBotId + ':' + telegramBotToken + '/sendMessage?chat_id=' + telegramChatId + '&parse_mode=html&text=' + tradeMessage)
  .then(res => {
  })
  .catch(err => {
    console.log('Telegram error: ', err.message);
  })
}

function sendCalculateProfitErrorMessage(axios, startOnUniswap, addrTokenName) {
  let tradeMessage = '<b><pre>!!!CALCULATE PROFIT ERROR!!!</pre></b>'

  if (startOnUniswap) {
    tradeMessage = tradeMessage + ' <pre>UniSwap -> SushiSwap</pre>%0A'
  } else {
    tradeMessage = tradeMessage + ' <pre>SushiSwap -> UniSwap</pre>%0A'
  }

  tradeMessage = tradeMessage + '<pre>WETH - ' + addrTokenName + '</pre>'

  axios.get('https://api.telegram.org/bot' + telegramBotId + ':' + telegramBotToken + '/sendMessage?chat_id=' + telegramChatId + '&parse_mode=html&text=' + tradeMessage)
  .then(res => {
  })
  .catch(err => {
    console.log('Telegram error: ', err.message);
  })
}

function logDifferences(web3, direction, aToB, amountIn, amountOut, uReserveWETH, uReserveShiba, sReserveShiba, sReserveWETH, uPrice, sPrice, difference) {
  console.log(`************************************************`)
  console.log(`direction: ${direction}`)
  console.log(`aToB: ${aToB}`)
  console.log(`amountIn: ${amountIn.toString()}`)
  console.log(`amountOut: ${Number(web3.utils.fromWei(amountOut.toString(), 'ether')).toFixed(0)}`)
  console.log(`uReserveWETH: ${Number(web3.utils.fromWei(uReserveWETH.toString(), 'ether')).toFixed(0)}`)
  console.log(`uReserveShiba: ${Number(web3.utils.fromWei(uReserveShiba.toString(), 'ether')).toFixed(0)}`)
  console.log(`sReserveWETH: ${Number(web3.utils.fromWei(sReserveWETH.toString(), 'ether')).toFixed(0)}`)
  console.log(`sReserveShiba: ${Number(web3.utils.fromWei(sReserveShiba.toString(), 'ether')).toFixed(0)}`)
  console.log(`uPrice: ${uPrice}`)
  console.log(`sPrice: ${sPrice}`)
  console.log(`difference: ${difference}`)
  console.log(`************************************************`)
}

async function getDifferenceUS(web3, directionWETHtoShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba) {
  // Amount of T1 received for swapping the precomputed amount of T0 on uniswap
  // сколько ШИБЫ можно купить за входной ЭФИР на юнисвапе
  const amountOut = await uRouter.methods.getAmountOut(amountIn, uReserveWETH, uReserveShiba).call()

  // Amount needed for repaying flashswap taken on sushiswap, used below
  // сколько ШИБЫ можно поменять на ЭФИР на сушисвапе за тоже количество ЭФИРа
  const sAmountIn = await sRouter.methods.getAmountIn(amountIn, sReserveShiba, sReserveWETH).call()

  // Uniswap price
  const uPrice = amountOut / amountIn

  // Sushiswap price
  const sPrice = sAmountIn / amountIn // trade price

  // Difference per T0 traded
  // если за то же количество ЭФИРа мы получим большее количество ШИБЫ на юнисвапе, то продав это большее количество ШИБы мы получим большее количество ЭФИРа
  const difference = uPrice - sPrice

  logDifferences(web3, US_DIRECTION, directionWETHtoShiba, amountIn, amountOut, uReserveWETH, uReserveShiba, sReserveShiba, sReserveWETH, uPrice, sPrice, difference);

  return difference
}

async function getDifferenceSU(web3, directionWETHtoShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba) {
  // Amount of T1 received for swapping the precomputed amount of T0 on uniswap
  const amountOut = await sRouter.methods.getAmountOut(amountIn, sReserveWETH, sReserveShiba).call()

  // Amount needed for repaying flashswap taken on sushiswap, used below
  const uAmountIn = await uRouter.methods.getAmountIn(amountIn, uReserveShiba, uReserveWETH).call()

  // Uniswap price
  const sPrice = amountOut / amountIn

  // Sushiswap price
  const uPrice = uAmountIn / amountIn // trade price

  // difference per T0 traded
  const difference = sPrice - uPrice

  logDifferences(web3, SU_DIRECTION, directionWETHtoShiba, amountIn, amountOut, uReserveWETH, uReserveShiba, sReserveShiba, sReserveWETH, uPrice, sPrice, difference);

  return difference
}

async function getTokenPriceUSD(axios, moralisApiKey, tokenAddress) {
  const response = await axios.get(
      'https://deep-index.moralis.io/api/v2/erc20/' + tokenAddress + '/price',
    {
        headers: {
          'x-api-key': moralisApiKey
        }
  });

  if (response.status == 200) {
    return response.data.usdPrice
  } else {
    return 0
  }
}

module.exports = {
  getReserveWETH,
  getReserveShiba,
  sendFoundMessage,
  sendArbitrageMessage,
  sendArbitrageErrorMessage,
  getDifferenceUS,
  getDifferenceSU,
  getTokenPriceUSD,
  sendCalculateProfitErrorMessage
}