"use client"

import { useState } from "react"
import axios from "axios"
import { BACKEND_URL, CLOUDFRONT_URL } from "@/utils"


export default function UploadImage({ onImageAdded, image }: {
  onImageAdded: (image: string) => void;
  image?: string;
}) {
  const [uploading, setUploading] = useState<boolean>(false);

  async function onFileSelect(e: any) {
    setUploading(true)
    try {
      const file = e.target.files[0]
      const response = await axios.get(`${BACKEND_URL}/v1/user/presignedUrl`, {
        headers: {
          Authorization: localStorage.getItem("token")
        }
      });
      const presignedUrl = response.data.presignedUrl;
      const formData = new FormData();
      formData.set("bucket", response.data.field.bucket);
      formData.set("X-Amz-Algorithm", response.data.field["X-Amz-Algorithm"]);
      formData.set("X-Amz-Credential", response.data.field["X-Amz-Credential"]);
      formData.set("X-Amz-Date", response.data.field["X-Amz-Date"]);
      formData.set("key", response.data.field["key"]);
      formData.set("Policy", response.data.field["Policy"]);
      formData.set("X-Amz-Signature", response.data.field["X-Amz-Signature"]);
      formData.set("file", file);
      const awsResponse = await axios.post(presignedUrl, formData);
      onImageAdded(`${CLOUDFRONT_URL}/${response.data.fields["key"]}`);
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
  }

  if (image) {
    return <img className="p-2 w-96 rounded" src={image} />
  }

  return <div>
    <div className="w-40 h-40 rounded border text-2xl cursor-pointer">
      <div className="h-full flex justify-center flex-col relative w-full">
        <div className="h-full flex justify-center w-full pt-16 text-4xl">
          {uploading ? <div className="text-sm">Loading...</div> : <>
            +
            <input type="file" className="bg-red-400 w-40 h-40" style={{ position: "absolute", opacity: 0, top: 0, bottom: 0, left: 0, right: 0, width: "100%", height: "100%" }}
              onChange={file => { onFileSelect }} />
          </>}
        </div>
      </div>
    </div>
  </div>
}