const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const RippleAPI = require('ripple-lib').RippleAPI;

const api = new RippleAPI({
  server: 'wss://s.altnet.rippletest.net:51233' // Testnet server
});

var resultObject;
var add = [];
var address;
var i = 0;
var secretKey = [];
var j = 0;
var maxLedgerVersion;
var userIds = []
var k = 0


api.connect();

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on("newMessage", (obj) => {
    obj["username"] = userIds[obj.id];
    io.emit("appendMessage", obj);
  });

  socket.on("sendingDetails", (details) => {
    add[i] = details.userAddress;
    secretKey[i] = details.userSecretKey;
    userIds[i++] = details.userId;

    console.log(details);
    socket.emit("sendingID", i-1);

  });


  socket.on('sendingAddress', (msg) => {
    add[i++] = msg
    address = msg;
    // const myAddress = address;
    // api.getAccountInfo(myAddress).then((info) => {
    //   console.log(info);
    //   console.log('getAccountInfo done');
    // });
    socket.emit("sendingID", i-1);
    // console.log('getting account info for', myAddress);
    // .then(info => {
    //
    //
    //   /* end custom code -------------------------------------- */
    // }).then(() => {
    //   return api.disconnect();
    // }).then(() => {
    //   console.log('done and disconnected.');
    // }).catch(console.error);
    // io.emit('chat message', msg);
  });

  socket.on('sendingKey', (res) => {
    secretKey[res.id] = res.key;
  });


  socket.on('getInfo', (id) => {
    const myAddress = add[id];
    api.getAccountInfo(myAddress).then((info) => {
      console.log(info);
      console.log('getAccountInfo done');
    });
  });


  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('makePayment', (req) => {
    senderAdd = add[req.id];
    receiverAdd = add[Number(!req.id)];
    doPrepare(senderAdd, receiverAdd, req.amount).then((txJSON) => {
      console.log("user id: "+ req.id+ "    Key: "+secretKey[req.id]);
      console.log(JSON.stringify(txJSON));
      const response = api.sign(txJSON, secretKey[req.id])
      const txID = response.id;
      console.log("Identifying hash:", txID);

      console.log(JSON.stringify())

      const txBlob = response.signedTransaction;
      console.log("Signed blob:", txBlob)

      const earliestLedgerVersion = doSubmit(txBlob);

      var display = {"from_id": req.id,  "amount": req.amount, "from_user": userIds[req.id], "receiverUser": userIds[Number(!req.id)]}
      console.log(display+"------")
      io.emit("paymentNotification", display);

      // socket.emit('makePayment',resultObject);
    });

  });

  // socket.on("getPay",(payinfo)=>{
  //   payinfo=resultObject
  //   socket.emit("sendPay",payinfo);
  // })

});




async function doPrepare(sender, receiver, amount) {
  // const sender = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
  const preparedTx = await api.prepareTransaction({
    "TransactionType": "Payment",
    "Account": sender,
    "Amount": api.xrpToDrops(amount), // Same as "Amount": "22000000"
    "Destination": receiver
  }, {
    // Expire this transaction if it doesn't execute within ~5 minutes:
    "maxLedgerVersionOffset": 75
  })
  maxLedgerVersion = preparedTx.instructions.maxLedgerVersion
  console.log("Prepared transaction instructions:", preparedTx.txJSON)
  console.log("Transaction cost:", preparedTx.instructions.fee, "XRP ")
  console.log("Transaction expires after ledger:", maxLedgerVersion)
  return preparedTx.txJSON
}

async function doSubmit(txBlob) {
  const latestLedgerVersion = await api.getLedgerVersion()

  const result = await api.submit(txBlob)

  console.log("Tentative result code:", result.resultCode)
  console.log("Tentative result message:", result.resultMessage)

  // resultObject["code"]=result.resultCode;
  // resultObject["message"]=result.resultMessage;


  // Return the earliest ledger index this transaction could appear in
  // as a result of this submission, which is the first one after the
  // validated ledger at time of submission.
  return latestLedgerVersion + 1
}

api.on('ledger', ledger => {
  console.log("Ledger version", ledger.ledgerVersion, "was validated.")
  if (ledger.ledgerVersion > maxLedgerVersion) {
    console.log("If the transaction hasn't succeeded by now, it's expired")
  }
});

async function checkTxnStatus(txID, earliestLedgerVersion){
  try {
    tx = await api.getTransaction(txID, {minLedgerVersion: earliestLedgerVersion})

    console.log("Transaction result:", tx.outcome.result)
    console.log("Balance changes:", JSON.stringify(tx.outcome.balanceChanges))
  } catch(error) {
    console.log("Couldn't get transaction outcome:", error)
  }
}

// api.connect().then(() => {
//   /* begin custom code ------------------------------------ */
//   const myAddress = add[0];
//
//   console.log('getting account info for', myAddress);
//   return api.getAccountInfo(myAddress);
//
// }).then(info => {
//   console.log(info);
//   console.log('getAccountInfo done');
//
//   /* end custom code -------------------------------------- */
// }).then(() => {
//   return api.disconnect();
// }).then(() => {
//   console.log('done and disconnected.');
// }).catch(console.error);


app.get('/', (req, res) => {
  res.sendFile(__dirname+ "/static/index.html");
});


http.listen(8080, () => {
  console.log('listening on *:8080');
});
