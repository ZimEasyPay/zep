import { Request, Response } from "express";
import path from "path";
import { createAuthenticatedClient, Grant } from "@interledger/open-payments";
import fs from "fs";

export const exampleController = async (req: Request, res: Response) => {
  const keyPath = path.join(__dirname, "../../private.key");
  let responses = {
    walletAddress: {},
    incomingPaymentGrant: {},
    incomingPayment: {},
    quoteGrant: {},
    quote: {},
    outgoingPaymentGrant: {},
  };

  const client = await createAuthenticatedClient({
    walletAddressUrl: "https://ilp.interledger-test.dev/ZimEasyPay",
    privateKey: keyPath,
    keyId: "ed32ca24-bb4a-480d-8eb9-1b0346202432",
  });

  // console.log(client);

  // 1. Resolve wallet address

  const walletAddress = await client.walletAddress.get({
    url: "https://ilp.interledger-test.dev/a2ed2ca1",
  });
  // console.log(walletAddress);

  responses.walletAddress = walletAddress;

  // 2. Create grant for incoming payment
  const incoming_payment_grant = (await client.grant.request(
    {
      url: walletAddress.authServer,
    },
    {
      access_token: {
        access: [
          {
            type: "incoming-payment",
            actions: ["list", "read", "read-all", "complete", "create"],
          },
        ],
      },
    }
  )) as Grant;

  responses.incomingPaymentGrant = incoming_payment_grant;

  //3. Create incoming payment

  const incomingPayment = await client.incomingPayment.create(
    {
      url: new URL("https://ilp.interledger-test.dev/a2ed2ca1").origin,
      accessToken: incoming_payment_grant.access_token.value,
    },
    {
      walletAddress: "https://ilp.interledger-test.dev/a2ed2ca1",
      incomingAmount: {
        value: "100",
        assetCode: walletAddress.assetCode,
        assetScale: 2,
      },
      expiresAt: new Date(Date.now() + 60_000 * 10).toISOString(),
    }
  );

  responses.incomingPayment = incomingPayment;

  // console.log(incomingPayment);

  //4. Create grant for quote
  const quote_grant = (await client.grant.request(
    {
      url: walletAddress.authServer,
    },
    {
      access_token: {
        access: [
          {
            type: "quote",
            actions: ["create", "read", "read-all"],
          },
        ],
      },
    }
  )) as Grant;

  responses.quoteGrant = quote_grant;

  // console.log(quote_grant);

  // 5. Create quote
  const quote = await client.quote.create(
    {
      url: new URL("https://ilp.interledger-test.dev/a2ed2ca1").origin,
      accessToken: quote_grant.access_token.value,
    },
    {
      method: "ilp",
      walletAddress: "https://ilp.interledger-test.dev/a2ed2ca1",
      receiver: incomingPayment.id,
    }
  );

  responses.quote = quote;

  //6. Create grant for outgoing payment
  const outgoing_payment_grant = (await client.grant.request(
    {
      url: walletAddress.authServer,
    },
    {
      access_token: {
        access: [
          {
            identifier: walletAddress.id,
            type: "outgoing-payment",
            actions: ["list", "list-all", "read", "read-all", "create"],
            limits: {
              debitAmount: quote.debitAmount,
              receiveAmount: quote.receiveAmount,
            },
          },
        ],
      },
      interact: {
        start: ["redirect"],
        finish: {
          method: "redirect",
          uri: "http://localhost:3001/redirect",
          nonce: "1234567890",
        },
      },
    }
  )) as any;

  responses.outgoingPaymentGrant = outgoing_payment_grant;

  fs.writeFile("data.json", JSON.stringify(responses, null, 2), (err) => {
    if (err) {
      console.error("Error writing to file", err);
    } else {
      console.log("File has been written");
    }
  });

  res.redirect(outgoing_payment_grant.interact.redirect);

  // console.log(JSON.stringify(continue_grant, null, 2));

  // const walletAddressKeys = await client.walletAddress.getKeys({
  //   url:"https://ilp.interledger-test.dev/ZimEasyPay",
  // });

  // console.log(walletAddressKeys);

  // res.json({ message: 'Hello from the example route!' });
};
