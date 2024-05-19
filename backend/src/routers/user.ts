import nacl from "tweetnacl";
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { DEFAULT_TASK_TITLE, JWT_SECRET, PARENT_WALLET_ADDRESS, TOTAL_DECIMALS } from "../config";
import { authMiddleware } from "../middleware";
import { createTaskInput } from "../types";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const connection = new Connection(process.env.RPC_URL ?? "");

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_KEY ?? "",
    secretAccessKey: process.env.AWS_SECRET ?? ""
  },
  region: "us-easy-1"
})

const router = Router();
const prisma = new PrismaClient();

prisma.$transaction(
  async (p) => {
    // Code running in a transaction...
  },
  {
    maxWait: 5000, // default: 2000
    timeout: 10000, // default: 5000
  }
)

router.get("/task", authMiddleware, async (req, res) => {

  // @ts-ignore
  const taskId: string = req.query.taskId;
  // @ts-ignore
  const userId: string = req.userId;
  const taskDetails = await prisma.task.findFirst({
    where: {
      id: Number(taskId),
      user_id: Number(userId)
    },
    include: {
      options: true
    }
  })

  if (!taskDetails) {
    return res.status(411).json({
      ok: false,
      message: "You don't have access to this task"
    })
  }

  // make it faster
  const responses = await prisma.submission.findMany({
    where: {
      task_id: Number(taskId)
    },
    include: {
      option: true
    }
  })

  let result: Record<string, {
    count: number,
    option: {
      imageUrl: string
    }
  }> = {}


  taskDetails?.options.forEach(r => {
    result[r.id] = {
      count: 0,
      option: {
        imageUrl: r.image_url
      }
    }
  })

  responses.forEach(r => {
    result[r.option_id].count++
  })

  return res.status(200).json({
    ok: true,
    data: result
  })

})

router.post("/task", authMiddleware, async (req, res) => {
  // @ts-ignore
  const userId = req.userId;
  const body = req.body;

  const parsedData = createTaskInput.safeParse(body);
  if (!parsedData.success) {
    return res.status(411).json({
      ok: false,
      message: "Wrong input data"
    })
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId
    }
  })

  const transaction = await connection.getTransaction(parsedData.data.signature, {
    maxSupportedTransactionVersion: 1
  });

  console.log(transaction);

  if ((transaction?.meta?.postBalances[1] ?? 0) - (transaction?.meta?.preBalances[1] ?? 0) !== 100000000) {
    return res.status(411).json({
      message: "Transaction signature/amount incorrect"
    })
  }

  if (transaction?.transaction.message.getAccountKeys().get(1)?.toString() !== PARENT_WALLET_ADDRESS) {
    return res.status(411).json({
      message: "Transaction sent to wrong address"
    })
  }

  if (transaction?.transaction.message.getAccountKeys().get(0)?.toString() !== user?.address) {
    return res.status(411).json({
      message: "Transaction sent to wrong address"
    })
  }
  // was this money paid by this user address or a different address?

  // parse the signature here to ensure the person has paid 0.1 SOL
  // const transaction = Transaction.from(parseData.data.signature);

  const response = await prisma.$transaction(async tx => {
    const response = await tx.task.create({
      data: {
        amount: 1 * TOTAL_DECIMALS,
        title: parsedData.data.title ?? DEFAULT_TASK_TITLE,
        signature: parsedData.data.signature,
        user_id: userId,
      }
    })

    await tx.option.createMany({
      data: parsedData.data.options.map(option => ({
        image_url: option.imageUrl,
        task_id: response.id
      }))
    })

    return response;
  })

  return res.status(200).json({
    ok: true,
    taskId: response.id
  })

})

router.get("/presignedUrl", authMiddleware, async (req, res) => {

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: 'somebucket',
    // @ts-ignore
    Key: `fiverr/${req.userId}/${Math.random}/image.jpg`,
    Conditions: [
      ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
    ],
    Fields: {
      'Content-Type': 'image/png'
    },
    Expires: 3600
  })

  return res.status(200).json({
    ok: true,
    presignedUrl: url,
    fields
  })
})

router.post("/signin", async (req, res) => {
  // TODO: Add sign verification logic here
  const { publicKey, signature } = req.body;
  const message = new TextEncoder().encode("Sign into mechanical turks");

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
    const existingUser = await prisma.user.findFirst({
      where: {
        address: publicKey
      }
    })

    let userId: Number | null = null;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const user = await prisma.user.create({
        data: {
          address: publicKey
        }
      })

      userId = user.id;
    }

    const token = jwt.sign({
      userId: userId
    }, JWT_SECRET)

    return res.status(200).json({
      ok: true,
      token
    })
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      message: "Server error"
    })
  }

})

export default router;