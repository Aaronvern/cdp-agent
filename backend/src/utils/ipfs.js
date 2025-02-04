// utils/ipfs.js
import { create } from 'ipfs-http-client';

const ipfs = create({ url: 'https://ipfs.infura.io:5001/api/v0' }); // You can also use other public IPFS gateways or run your own node

/**
 * Upload data to IPFS
 * @param {string} content - The content you want to store on IPFS.
 * @returns {Promise<string>} - Returns the IPFS hash (CID) of the uploaded content.
 */
async function uploadToIPFS(content) {
  try {
    const { path } = await ipfs.add(content);
    console.log(`Successfully uploaded to IPFS: ${path}`);
    return path; // The CID (Content Identifier) of the uploaded content
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw new Error('Failed to upload to IPFS');
  }
}

export { uploadToIPFS };
