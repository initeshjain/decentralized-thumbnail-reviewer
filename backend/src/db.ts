import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getNextTask = async (userId: number) => {
  const nextTask = await prisma.task.findFirst({
    where: {
      done: false,
      submission: {
        none: {
          worker_id: userId,
        }
      }
    },
    select: {
      id: true,
      amount: true,
      title: true,
      options: true
    }
  })

  return nextTask;
}