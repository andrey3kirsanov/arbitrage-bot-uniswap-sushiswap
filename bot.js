require('dotenv').config() // for importing parameters
const axios = require('axios');
const Web3 = require('web3')
const HDWalletProvider = require("@truffle/hdwallet-provider");
const { getReserveWETH, getReserveShiba, sendFoundMessage, sendArbitrageMessage,
    sendArbitrageErrorMessage, getDifferenceUS, getDifferenceSU, getTokenPriceUSD,
    sendCalculateProfitErrorMessage } = require('./helpers')

// ABIs
const IFactory = require('@uniswap/v2-core/build/IUniswapV2Factory.json')
const IPair = require('@uniswap/v2-core/build/IUniswapV2Pair.json')  
const IRouter = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const Utils = require('./build/contracts/Utils.json')
const IERC20 = require('@uniswap/v2-periphery/build/IERC20.json')
const Arbitrage = require('./build/contracts/Arbitrage.json')

// Importing parameters from .env (mostly given)
const arbitrageContract = process.env.ADDR_ARBITRAGE_CONTRACT
const moralisApiKey = process.env.MORALIS_API_KEY
const addrSFactory = process.env.ADDR_SFACTORY
const addrSRouter = process.env.ADDR_SROUTER
const addrTokenWETH = process.env.ADDR_WETH
const addrTokenShiba = process.env.TOKEN_CONTRACT
const addrTokenName = process.env.TOKEN_NAME
const addrUFactory = process.env.ADDR_UFACTORY
const addrURouter = process.env.ADDR_UROUTER
const addrUtils = process.env.ADDR_UTILS
const privateKey = process.env.PRIVATE_KEY
const gas = process.env.GAS_LIMIT

// Setting up provider
console.log('wss://eth-mainnet.g.alchemy.com CONNECTING')

const provider = new HDWalletProvider({
    privateKeys: [process.env.PRIVATE_KEY],
    providerOrUrl: `wss://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
})

let web3 = new Web3(provider)

console.log('wss://eth-mainnet.g.alchemy.com CONNECTED')

// Contracts
const uFactory = new web3.eth.Contract(IFactory.abi, addrUFactory)
const uRouter = new web3.eth.Contract(IRouter.abi, addrURouter)
const sFactory = new web3.eth.Contract(IFactory.abi, addrSFactory) // Sushiswap, same ABIs, sushiswap forked uniswap so, basically same contracts
const sRouter = new web3.eth.Contract(IRouter.abi, addrSRouter)
const tokenWETH = new web3.eth.Contract(IERC20.abi, addrTokenWETH) // Henceforth T0 WETH
console.log('*** addrToken *** - ' + addrTokenShiba)
console.log('*** addrTokenName *** - ' + addrTokenName)
const tokenShiba = new web3.eth.Contract(IERC20.abi, addrTokenShiba) // and T1
const utils = new web3.eth.Contract(Utils.abi, addrUtils) // Because includes an support math function that its required
const arbitrage = new web3.eth.Contract(Arbitrage.abi, arbitrageContract);

// Async variables
let uPair, sPair, walletAddress, token0Name, token1Name, token0Symbol, token1Symbol
let isExecuting = false

const US_FOUND_MESSAGE = `!!! U => S difference FOUND !!! `
const SU_FOUND_MESSAGE = `!!! S => U difference FOUND !!! `
const US_NOT_FOUND_MESSAGE = `!!! U => S difference NOT FOUND !!! `
const SU_NOT_FOUND_MESSAGE = `!!! S => U difference NOT FOUND !!! `
const US_NO_ARBITRAGE_OPPORTUNITY_MESSAGE = `computeProfitMaximizingTrade U => S. No arbitrage opportunity on block`
const SU_NO_ARBITRAGE_OPPORTUNITY_MESSAGE = `computeProfitMaximizingTrade S => U. No arbitrage opportunity on block`
const DIRECTION_MESSAGE = `!!! aToB !!! `
const AMOUNT_IN_MESSAGE = `!!! amountIn !! - `

const main = async () => {
    // Token pairs
    uPair = new web3.eth.Contract(IPair.abi, (await uFactory.methods.getPair(tokenWETH.options.address, tokenShiba.options.address).call()))
    sPair = new web3.eth.Contract(IPair.abi, (await sFactory.methods.getPair(tokenWETH.options.address, tokenShiba.options.address).call()))

    // Account with you will be using to sign the transactions
    const wallet = await web3.eth.accounts.privateKeyToAccount(privateKey)
    walletAddress = wallet.address

    token0Name = await tokenWETH.methods.name().call()
    token0Symbol = await tokenWETH.methods.symbol().call()
    token1Name = await tokenShiba.methods.name().call()
    token1Symbol = await tokenShiba.methods.symbol().call()

    // ********************************************* UNISWAP PAIR ********************************************* //

    uPair.events.Swap({}, async () => {
        if (!isExecuting) {
            isExecuting = true

            try {
                let uReserves, uReserveWETH, uReserveShiba, sReserves, sReserveWETH, sReserveShiba
                
                // Tokens reserves on uniswap
                uReserves = await uPair.methods.getReserves().call()

                uReserveWETH = getReserveWETH(web3, uReserves)
                uReserveShiba = getReserveShiba(web3, uReserves)

                // Tokens reserves on sushiswap
                sReserves = await sPair.methods.getReserves().call()

                sReserveWETH = getReserveWETH(web3, sReserves)
                sReserveShiba = getReserveShiba(web3, sReserves)

                // Compute amount that must be traded to maximize the profit and, trade direction; function provided by uniswap
                let result = await utils.methods.computeProfitMaximizingTrade(sReserveWETH, sReserveShiba, uReserveWETH, uReserveShiba).call()

                let directionWETHToShiba = result[0] // trade direction
                let amountIn = result[1]

                if (Number(web3.utils.fromWei(amountIn.toString(), 'ether') < Number(web3.utils.fromWei('50000000000000000', 'ether')))) {
                    console.log(AMOUNT_IN_MESSAGE + amountIn);
                    console.log(SU_NO_ARBITRAGE_OPPORTUNITY_MESSAGE);
                } else {
                    console.log(DIRECTION_MESSAGE + directionWETHToShiba);

                    if (directionWETHToShiba) {
                        const difference = await getDifferenceUS(web3, directionWETHToShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba)

                        if (difference <= 0) {
                            console.log(US_NOT_FOUND_MESSAGE + difference)

                            const difference_2 = await getDifferenceSU(web3, directionWETHToShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba)

                            if (difference_2 <= 0) {
                                console.log(SU_NOT_FOUND_MESSAGE + difference_2)
                            } else { // !!! FOUND !!!
                                console.log(SU_FOUND_MESSAGE + difference_2)

                                calculateProfitAndExecuteTrade(web3, false, difference_2, amountIn)
                            }
                        } else { // !!! FOUND !!!
                            console.log(US_FOUND_MESSAGE + difference)

                            calculateProfitAndExecuteTrade(web3, true, difference, amountIn)
                        }
                    }
                }

                try {
                    let uReserves, uReserveWETH, uReserveShiba, sReserves, sReserveWETH, sReserveShiba

                    // Tokens reserves on uniswap
                    uReserves = await uPair.methods.getReserves().call()

                    uReserveWETH = getReserveWETH(web3, uReserves)
                    uReserveShiba = getReserveShiba(web3, uReserves)

                    // Tokens reserves on sushiswap
                    sReserves = await sPair.methods.getReserves().call()

                    sReserveWETH = getReserveWETH(web3, sReserves)
                    sReserveShiba = getReserveShiba(web3, sReserves)

                    // Compute amount that must be traded to maximize the profit and, trade direction; function provided by uniswap
                    let result = await utils.methods.computeProfitMaximizingTrade(uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba).call()

                    let directionWETHToShiba = result[0] // Trade direction
                    let amountIn = result[1]

                    if (Number(web3.utils.fromWei(amountIn.toString(), 'ether') < Number(web3.utils.fromWei('50000000000000000', 'ether')))) {
                        console.log(AMOUNT_IN_MESSAGE + amountIn);
                        console.log(US_NO_ARBITRAGE_OPPORTUNITY_MESSAGE);
                    } else {
                        console.log(DIRECTION_MESSAGE + directionWETHToShiba);

                        if (directionWETHToShiba) {
                            const difference = await getDifferenceSU(web3, directionWETHToShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba)

                            if (difference <= 0) {
                                console.log(SU_NOT_FOUND_MESSAGE + difference)

                                const difference_2 = await getDifferenceUS(web3, directionWETHToShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba)

                                if (difference_2 <= 0) {
                                    console.log(US_NOT_FOUND_MESSAGE + difference_2)
                                } else { // !!! FOUND !!!
                                    console.log(US_FOUND_MESSAGE + difference_2)

                                    calculateProfitAndExecuteTrade(web3, true, difference_2, amountIn)
                                }
                            } else { // !!! FOUND !!!
                                console.log(SU_FOUND_MESSAGE + difference)

                                calculateProfitAndExecuteTrade(web3, false, difference, amountIn)
                            }
                        }
                    }
                } catch(error) {
                    console.log(error)
                }
            } catch(error) {
                console.log(error)
            }

            isExecuting = false
        }
    })

    // ********************************************* SUSHISWAP PAIR ********************************************* //

    sPair.events.Swap({}, async () => {
        if (!isExecuting) {
            isExecuting = true

            try {
                let uReserves, uReserveWETH, uReserveShiba, sReserves, sReserveWETH, sReserveShiba

                // Tokens reserves on uniswap
                uReserves = await uPair.methods.getReserves().call()

                uReserveWETH = getReserveWETH(web3, uReserves)
                uReserveShiba = getReserveShiba(web3, uReserves)

                // Tokens reserves on sushiswap
                sReserves = await sPair.methods.getReserves().call()

                sReserveWETH = getReserveWETH(web3, sReserves)
                sReserveShiba = getReserveShiba(web3, sReserves)

                // Compute amount that must be traded to maximize the profit and, trade direction; function provided by uniswap
                let result = await utils.methods.computeProfitMaximizingTrade(sReserveWETH, sReserveShiba, uReserveWETH, uReserveShiba).call()

                let directionWETHToShiba = result[0] // trade direction
                let amountIn = result[1]

                if (Number(web3.utils.fromWei(amountIn.toString(), 'ether') < Number(web3.utils.fromWei('50000000000000000', 'ether')))) {
                    console.log(AMOUNT_IN_MESSAGE + amountIn);
                    console.log(SU_NO_ARBITRAGE_OPPORTUNITY_MESSAGE);
                } else {
                    console.log(DIRECTION_MESSAGE + directionWETHToShiba);

                    if (directionWETHToShiba) {
                        const difference = await getDifferenceUS(web3, directionWETHToShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba)

                        if (difference <= 0) {
                            console.log(US_NOT_FOUND_MESSAGE + difference)

                            const difference_2 = await getDifferenceSU(web3, directionWETHToShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba)

                            if (difference_2 <= 0) {
                                console.log(SU_NOT_FOUND_MESSAGE + difference_2)
                            } else { // !!! FOUND !!!
                                console.log(SU_FOUND_MESSAGE + difference_2)

                                calculateProfitAndExecuteTrade(web3, false, difference_2, amountIn)
                            }
                        } else { // !!! FOUND !!!
                            console.log(US_FOUND_MESSAGE + difference)

                            calculateProfitAndExecuteTrade(web3, true, difference, amountIn)
                        }
                    }
                }

                try {
                    let uReserves, uReserveWETH, uReserveShiba, sReserves, sReserveWETH, sReserveShiba

                    // Tokens reserves on uniswap
                    uReserves = await uPair.methods.getReserves().call()

                    uReserveWETH = getReserveWETH(web3, uReserves)
                    uReserveShiba = getReserveShiba(web3, uReserves)

                    // Tokens reserves on sushiswap
                    sReserves = await sPair.methods.getReserves().call()

                    sReserveWETH = getReserveWETH(web3, sReserves)
                    sReserveShiba = getReserveShiba(web3, sReserves)

                    // Compute amount that must be traded to maximize the profit and, trade direction; function provided by uniswap
                    let result = await utils.methods.computeProfitMaximizingTrade(uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba).call()

                    let directionWETHToShiba = result[0] // Trade direction
                    let amountIn = result[1]

                    if (Number(web3.utils.fromWei(amountIn.toString(), 'ether') < Number(web3.utils.fromWei('50000000000000000', 'ether')))) {
                        console.log(AMOUNT_IN_MESSAGE + amountIn);
                        console.log(US_NO_ARBITRAGE_OPPORTUNITY_MESSAGE);
                    }

                    console.log(DIRECTION_MESSAGE + directionWETHToShiba);

                    if (directionWETHToShiba) {
                        const difference = await getDifferenceSU(web3, directionWETHToShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba)

                        if (difference <= 0) {
                            console.log(SU_NOT_FOUND_MESSAGE + difference)

                            const difference_2 = await getDifferenceUS(web3, directionWETHToShiba, uRouter, sRouter, amountIn, uReserveWETH, uReserveShiba, sReserveWETH, sReserveShiba)

                            if (difference <= 0) {
                                console.log(US_NOT_FOUND_MESSAGE + difference_2)
                            } else { // !!! FOUND !!!
                                console.log(US_FOUND_MESSAGE + difference_2)

                                calculateProfitAndExecuteTrade(web3, true, difference_2, amountIn)
                            }
                        } else { // !!! FOUND !!!
                            console.log(SU_FOUND_MESSAGE + difference)

                            calculateProfitAndExecuteTrade(web3, false, difference, amountIn)
                        }
                    }
                } catch(error) {
                    console.log(error)
                }
            } catch(error) {
                console.log(error)
            }

            isExecuting = false
        }
    })

    console.log("Waiting for swap event...")
}

const calculateProfitAndExecuteTrade = async (web3, startOnUniswap, difference, amountIn) => {
    try {
        const gasPrice = await web3.eth.getGasPrice()
        const gasCost = Number(gasPrice) * gas / 10 ** 18
        const gasCostUSD = gasCost * getTokenPriceUSD(axios, moralisApiKey, addrTokenWETH)

        const shibaDifferenceUSD = difference * getTokenPriceUSD(axios, moralisApiKey, addrTokenShiba)

        const profit = shibaDifferenceUSD - gasCostUSD

        sendFoundMessage(axios, startOnUniswap, addrTokenName, addrTokenShiba, difference, amountIn, gasPrice, gasCost, gasCostUSD, shibaDifferenceUSD, profit)

        if (profit > 0) {
            await executeTrade(startOnUniswap, addrTokenName, addrTokenWETH, addrTokenShiba, walletAddress, amountIn, gas, profit)
        }
    } catch(error) {
        sendCalculateProfitErrorMessage(axios, startOnUniswap, addrTokenName)
        console.log(error)
    }
}

const executeTrade = async (startOnUniswap, addrTokenName, token0Address, token1Address, account, amount, gas, profit) => {
    try {
        console.log(`Attempting Arbitrage...`)

        // TODO deploy DyDx Arbitrage contract using my wallet on Remix IDE
        //await arbitrage.methods.executeTrade(startOnUniswap, token0Address, token1Address, amount).send({ from: account, gas: gas })

        console.log(`!!! Trade Complete !!!`)

        const ethBalanceAfter = await web3.eth.getBalance(account)

        sendArbitrageMessage(axios, web3, startOnUniswap, ethBalanceAfter, addrTokenName, profit)
    } catch(error) {
        const ethBalanceAfter = await web3.eth.getBalance(account)

        sendArbitrageErrorMessage(axios, web3, startOnUniswap, ethBalanceAfter, addrTokenName, profit)
        console.log(error)
    }
}

main()