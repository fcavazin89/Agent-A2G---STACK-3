import { useState, useCallback } from 'react';

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  balance: string;
  network: string;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    balance: '0.00',
    network: 'Base Sepolia'
  });

  const connect = useCallback(() => {
    // Simulated connection
    setWallet({
      address: '0x742d...44e',
      isConnected: true,
      balance: '1.45 ETH',
      network: 'Base Sepolia'
    });
  }, []);

  const disconnect = useCallback(() => {
    setWallet({
      address: null,
      isConnected: false,
      balance: '0.00',
      network: 'Base Sepolia'
    });
  }, []);

  return { wallet, connect, disconnect };
}
