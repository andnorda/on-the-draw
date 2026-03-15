import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

const players = defineCollection({
  loader: file("src/data/players.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    location: z.string(),
    country: z.string().length(2),
    mtgo: z.string().nullable(),
    mtga: z.string().nullable(),
    meleegg: z.string().nullable(),
    mtgelo: z.string().nullable(),
    aliases: z.array(z.string()).optional(),
  }),
});

export const collections = { players };
