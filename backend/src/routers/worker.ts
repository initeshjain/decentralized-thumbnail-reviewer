import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import jwt, { sign } from "jsonwebtoken";
import { TOTAL_DECIMALS, TOTAL_SUBMISSIONS, WORKER_JWT_SECRET } from "../config";
import { workerAuthMiddleware } from "../middleware";
import { getNextTask } from "../db";
import { createSubmissionInput } from "../types";
import nacl from "tweetnacl";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { privateKey } from "../privateKey";
import { decode } from "bs58";
const connection = new Connection(process.env.RPC_URL ?? "");

const router = Router();
const prisma = new PrismaClient();

// prisma.$transaction(
//   async (p) => {
//     // Code running in a transaction...
//   },
//   {
//     maxWait: 5000, // default: 2000
//     timeout: 10000, // default: 5000
//   }
// )

router.post("/payout", workerAuthMiddleware, async (req, res) => {

  // @ts-ignore
  const userId: string = req.userId;
  const worker = await prisma.worker.findFirst({
    where: { id: Number(userId) }
  })

  if (!worker) {
    return res.status(403).json({
      ok: false,
      message: "User not found"
    })
  }

  if (worker.pending_amount === 0) {
    return res.status(403).json({
      ok: false,
      message: "Insufficient balance",
      balance: worker.pending_amount
    })
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(process.env.PARENT_WALLET_ADDRESS ?? ""),
      toPubkey: new PublicKey(worker.address),
      lamports: 1000_000_000 * worker.pending_amount / TOTAL_DECIMALS,
    })
  );

  console.log(worker.address);

  const keypair = Keypair.fromSecretKey(decode(privateKey));

  // TODO: There's a double spending problem here
  // The user can request the withdrawal multiple times
  // Can u figure out a way to fix it?

  let signature = "";
  try {
    signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
    );

  } catch (e) {
    return res.json({
      message: "Transaction failed"
    })
  }

  console.log(signature)

  // TODO: we should add a lock here
  await prisma.$transaction(async tx => {
    await tx.worker.update({
      where: {
        id: Number(userId)
      },
      data: {
        pending_amount: {
          decrement: worker.pending_amount
        },
        locked_amount: {
          increment: worker.pending_amount
        }
      }
    })

    await tx.payouts.create({
      data: {
        amount: worker.pending_amount,
        user_id: Number(userId),
        status: "Processing",
        signature: signature,
      }
    })
  })

  // send the txn to the solana blockchain
  return res.status(200).json({
    ok: true,
    message: "Processing payout",
    amount: worker.pending_amount
  })

})

router.get("/balance", workerAuthMiddleware, async (req, res) => {
  // @ts-ignore
  const userId = Number(req.userId);

  const worker = await prisma.worker.findFirst({
    where: {
      id: userId
    }
  })

  return res.status(200).json({
    ok: true,
    balance: {
      pendingAmount: worker?.pending_amount,
      lockedAmount: worker?.locked_amount
    }
  })
})

router.post("/submission", workerAuthMiddleware, async (req, res) => {

  // @ts-ignore
  const userId: string = req.userId;
  const body = req.body;

  const parsedData = createSubmissionInput.safeParse(body);

  if (!parsedData.success) {
    return res.status(411).json({
      ok: false,
      message: "Wrong input data"
    })
  }

  const task = await getNextTask(Number(userId));
  if (!task || task?.id !== Number(parsedData.data.taskId)) {
    return res.status(411).json({
      ok: false,
      message: "Wrong task id"
    })
  }

  const amount = (Number(task.amount) / TOTAL_SUBMISSIONS).toString()


  const submission = await prisma.$transaction(async tx => {
    const submission = await tx.submission.create({
      data: {
        option_id: Number(parsedData.data.selection),
        worker_id: Number(userId),
        task_id: Number(parsedData.data.taskId),
        amount: Number(amount)
      }
    })

    await tx.worker.update({
      where: {
        id: Number(userId)
      },
      data: {
        pending_amount: {
          increment: Number(amount)
        }
      }
    })

    return submission;
  })

  const nextTask = await getNextTask(Number(userId));

  return res.status(200).json({
    ok: true,
    task: nextTask,
    amount
  })
})

router.get("/nextTask", workerAuthMiddleware, async (req, res) => {
  // @ts-ignore 
  const userId: string = req.userId;

  const nextTask = await getNextTask(Number(userId));

  if (!nextTask) {
    return res.status(411).json({
      ok: true,
      message: "No more tasks are left for you to review"
    })
  }

  return res.status(200).json({
    ok: true,
    task: nextTask
  })

})

router.post("/signin", async (req, res) => {
  // TODO: Add sign verification logic here
  // TODO: Add sign verification logic here
  const { publicKey, signature } = req.body;
  const message = new TextEncoder().encode("Sign into mechanical turks as a worker");

  const result = nacl.sign.detached.verify(
    message,
    new Uint8Array(signature.data),
    new PublicKey(publicKey).toBytes(),
  );


  if (!result) {
    return res.status(411).json({
      message: "Incorrect signature"
    })
  }

  try {
    const existingUser = await prisma.worker.findFirst({
      where: {
        address: publicKey
      }
    })

    if (existingUser) {
      const token = jwt.sign({
        userId: existingUser.id
      }, WORKER_JWT_SECRET)

      return res.status(200).json({
        ok: true,
        token,
        amount: existingUser.pending_amount / TOTAL_DECIMALS
      })

    } else {
      const worker = await prisma.worker.create({
        data: {
          address: publicKey,
          locked_amount: 0,
          pending_amount: 0
        }
      })

      const token = jwt.sign({
        userId: worker.id
      }, WORKER_JWT_SECRET)

      return res.status(200).json({
        ok: true,
        token,
        amount: 0
      })
    }


  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      message: "Server error"
    })
  }

})

export default router; 