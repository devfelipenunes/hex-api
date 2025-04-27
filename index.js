import {
  Coinbase,
  ExternalAddress,
  StakeOptionsMode,
} from '@coinbase/coinbase-sdk';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const apiKeyFilePath = './cdp_api_key.json';
Coinbase.configureFromJson({ filePath: apiKeyFilePath });

app.post('/stake', async (req, res) => {
  const { walletAddress } = req.body;

  try {
    const address = new ExternalAddress(
      Coinbase.networks.EthereumHolesky,
      walletAddress
    );

    const stakeableBalance = await address.stakeableBalance(
      Coinbase.assets.Eth,
      StakeOptionsMode.PARTIAL
    );

    if (stakeableBalance < 0.005) {
      return res
        .status(400)
        .json({ error: 'Saldo insuficiente para staking!' });
    }

    const stakingOperation = await address.buildStakeOperation(
      0.005,
      Coinbase.assets.Eth,
      StakeOptionsMode.PARTIAL
    );

    const unsignedTransactions = stakingOperation.getTransactions();

    if (!unsignedTransactions || !Array.isArray(unsignedTransactions)) {
      return res.status(500).json({
        error: 'Nenhuma transação retornada para staking.',
        details: stakingOperation,
      });
    }

    const txsToSend = unsignedTransactions
      .map((tx) => {
        try {
          const unsignedPayloadHex = tx.model.unsigned_payload.slice(2);
          const decodedPayloadString = Buffer.from(
            unsignedPayloadHex,
            'hex'
          ).toString();

          const validPayloadString = `{${decodedPayloadString}`;

          const decodedPayload = JSON.parse(validPayloadString);

          return {
            to: decodedPayload.to,
            data: decodedPayload.data || decodedPayload.input || null,
            value: decodedPayload.value || '0',
          };
        } catch (error) {
          return null;
        }
      })
      .filter((tx) => tx !== null);

    res.json({ success: true, transactions: txsToSend });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'Erro interno no servidor', details: error.message });
  }
});

app.listen(3003, () => {});
