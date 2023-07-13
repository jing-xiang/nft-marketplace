// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import * as fs from "fs";
import * as path from "path";

export default function handler(req, res) {
  const approvalpath = path.join(
    __dirname,
    "../../../../assets/artifacts/nft-marketplace/approval.teal"
  );
  const data1 = fs.readFileSync(approvalpath);
  const clearPath = path.join(
    __dirname,
    "../../../../assets/artifacts/nft-marketplace/clear.teal"
  );
  const data2 = fs.readFileSync(clearPath);
  res.status(200).json({ data1, data2 });
}
