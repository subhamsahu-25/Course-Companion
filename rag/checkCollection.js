import 'dotenv/config';
import { getQdrantClient, getCollectionName } from "./qdrant.js";

const client = getQdrantClient();
const collectionName = getCollectionName();

const info = await client.getCollection(collectionName);
console.log(
   JSON.stringify(
      {
         collection: collectionName,
         points: info.points_count,
         status: info.status,
      },
      null,
      2
   )
);

const peek = await client.scroll(collectionName, {
   limit: 3,
   with_payload: true,
   with_vector: false,
});
console.log(JSON.stringify(peek.points.map((p) => p.payload), null, 2));
