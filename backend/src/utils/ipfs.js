// utils/ipfs.js
const pinataSDK = require('@pinata/sdk');

class IPFSService {
  constructor() {
    this.pinata = null;
  }

  initializePinata() {
    if (this.pinata) return;

    const apiKey = process.env.PINATA_API_KEY;
    const secretKey = process.env.PINATA_SECRET_KEY;

    if (!apiKey || !secretKey) {
      throw new Error(
        'Missing Pinata API credentials in environment variables.\n' +
        'Please add PINATA_API_KEY and PINATA_SECRET_KEY to your .env file.\n' +
        'You can get these credentials by signing up at https://app.pinata.cloud/'
      );
    }

    this.pinata = new pinataSDK(apiKey, secretKey);
  }

  async uploadToIPFS(content, metadata = {}) {
    try {
      // Initialize Pinata if not already initialized
      this.initializePinata();

      // Add input validation
      if (!content) {
        throw new Error('Content is required for IPFS upload');
      }

      // Ensure content is properly stringified if it's an object
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
        // Return a mock response for development/testing
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
