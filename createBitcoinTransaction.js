import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";

// 네트워크 설정 (메인넷 또는 테스트넷)
const network = bitcoin.networks.bitcoin; // 메인넷
// const network = bitcoin.networks.testnet; // 테스트넷 (테스트용)

// 개인 키 설정 (테스트용)
const privateKey = "your_private_key_here"; // 비트코인 개인 키 (WIF 포맷)
const keyPair = bitcoin.ECPair.fromWIF(privateKey, network); // 개인 키로 KeyPair 생성

// 수수료 지갑 설정
const feeReceiverAddress = "1HaUxfi3eBu8ari6BUWpP6QFVjTNBVWFA"; // 수수료 지갑 주소

// 거래 데이터 설정
const toAddress = "1RecipientAddressHere"; // 수신자 주소
const amount = 1000; // 전송 금액 (사토시 단위)
const fee = 1000; // 트랜잭션 수수료 (사토시 단위)

// 비트코인 UTXO 데이터 가져오기
async function getUTXOs(address) {
  const response = await axios.get(`https://blockstream.info/api/address/${address}/utxo`);
  return response.data;
}

// 비트코인 트랜잭션 생성
async function createTransaction(fromAddress) {
  const utxos = await getUTXOs(fromAddress);

  if (!utxos || utxos.length === 0) {
    throw new Error("No UTXOs available for the given address.");
  }

  const psbt = new bitcoin.Psbt({ network });

  let inputAmount = 0;

  // UTXO 추가
  utxos.forEach((utxo) => {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: bitcoin.address.toOutputScript(fromAddress, network),
        value: utxo.value,
      },
    });
    inputAmount += utxo.value;
  });

  // 잔액 확인
  if (inputAmount < amount + fee) {
    throw new Error("Insufficient funds to cover the transaction and fees.");
  }

  // 출력 추가 (수신자 주소)
  psbt.addOutput({
    address: toAddress,
    value: amount,
  });

  // 출력 추가 (수수료 지갑 주소)
  psbt.addOutput({
    address: feeReceiverAddress, // 수수료를 받을 주소
    value: fee,
  });

  // 출력 추가 (잔액 반환)
  psbt.addOutput({
    address: fromAddress, // 잔액 반환 주소
    value: inputAmount - amount - fee,
  });

  // 서명
  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();

  // 서명된 트랜잭션 가져오기
  const txHex = psbt.extractTransaction().toHex();
  return txHex;
}

// 트랜잭션 브로드캐스트
async function broadcastTransaction(txHex) {
  const response = await axios.post("https://blockstream.info/api/tx", txHex);
  return response.data;
}

// 실행
(async () => {
  const fromAddress = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network }).address;
  console.log("Sender Address:", fromAddress);

  try {
    const txHex = await createTransaction(fromAddress);
    console.log("Signed Transaction Hex:", txHex);

    const txHash = await broadcastTransaction(txHex);
    console.log("Transaction Sent. Hash:", txHash);
  } catch (error) {
    console.error("Error:", error.message);
  }
})();
