const pinataSDK = require('@pinata/sdk');
const config = require('../config/config');

class IPFSService {
  constructor() {
    this.pinata = null;
  }

  initializePinata() {
    if (this.pinata) return;

    if (!config.ipfs.pinataApiKey || !config.ipfs.pinataSecretKey) {
      throw new Error(
        'Missing Pinata API credentials.\n' +
        'Please add PINATA_API_KEY and PINATA_SECRET_KEY to your .env file.'
      );
    }

    this.pinata = new pinataSDK(
      config.ipfs.pinataApiKey,
      config.ipfs.pinataSecretKey
    );
  }

  async uploadToIPFS(content, metadata = {}) {
    try {
      this.initializePinata();

      if (!content) {
        throw new Error('Content is required for IPFS upload');
      }

      const contentToUpload = typeof content === 'object' ? 
        JSON.stringify(content) : content;

      const options = {
        pinataMetadata: {
          name: `Product-Analysis-${Date.now()}`,
          ...metadata
        },
        pinataOptions: {
          cidVersion: 1
        }
      };

      const result = await this.pinata.pinJSONToIPFS(contentToUpload, options);
      const uri = `ipfs://${result.IpfsHash}`;
      console.log(`Successfully uploaded to IPFS: ${uri}`);
      
      return {
        uri,
        hash: result.IpfsHash,
        gateway_url: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
      };
    } catch (error) {
      if (error.message.includes('Missing Pinata API credentials')) {
        console.error('\nPinata API credentials are missing. Data will not be stored on IPFS.');
        return {
          uri: 'ipfs://mock-hash',
          hash: 'mock-hash',
          gateway_url: 'https://gateway.pinata.cloud/ipfs/mock-hash',
          mock: true
        };
      }
      console.error("Error uploading to IPFS:", error);
      throw new Error(`Failed to upload to IPFS: ${error.message}`);
    }
  }
}

module.exports = new IPFSService(); 