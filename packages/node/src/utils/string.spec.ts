// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Interface, EventFragment } from '@ethersproject/abi';
import { id } from '@ethersproject/hash';
import { eventToTopic, functionToSighash } from './string';

describe('String utilities', () => {
  describe('eventToTopic', () => {
    it('should return hex string as-is', () => {
      const hexInput =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(eventToTopic(hexInput)).toBe(hexInput);
    });

    it('should generate topic hash for standard event signature', () => {
      const signature = 'Transfer(address,address,uint256)';
      const expected = id(signature);
      expect(eventToTopic(signature)).toBe(expected);
    });

    it('should cache results', () => {
      const signature = 'Transfer(address,address,uint256)';
      const firstResult = eventToTopic(signature);
      const secondResult = eventToTopic(signature);
      expect(firstResult).toBe(secondResult);
    });

    describe('custom type resolution', () => {
      const mockAbi = [
        {
          type: 'event',
          name: 'DisputeOpen',
          inputs: [
            {
              type: 'uint256',
              name: 'disputeId',
              indexed: true,
              internalType: 'uint256',
            },
            {
              type: 'address',
              name: 'fisherman',
              indexed: false,
              internalType: 'address',
            },
            {
              type: 'address',
              name: 'runner',
              indexed: false,
              internalType: 'address',
            },
            {
              type: 'uint8',
              name: '_type',
              indexed: false,
              internalType: 'enum DisputeType',
            },
          ],
        },
        {
          type: 'event',
          name: 'DataUpdated',
          inputs: [
            {
              type: 'address',
              name: 'user',
              indexed: true,
              internalType: 'address',
            },
            {
              type: 'tuple',
              name: 'data',
              indexed: false,
              internalType: 'struct MoreData',
              components: [
                { type: 'bytes32', name: 'field1', internalType: 'bytes32' },
                { type: 'bytes32', name: 'field2', internalType: 'bytes32' },
              ],
            },
          ],
        },
        {
          type: 'event',
          name: 'ComplexEvent',
          inputs: [
            {
              type: 'uint8',
              name: 'status',
              indexed: false,
              internalType: 'enum MyContract.Status',
            },
            {
              type: 'tuple',
              name: 'nestedData',
              indexed: false,
              internalType: 'struct MyContract.NestedData',
              components: [
                { type: 'uint256', name: 'value', internalType: 'uint256' },
                { type: 'bool', name: 'active', internalType: 'bool' },
              ],
            },
          ],
        },
      ];

      const iface = new Interface(mockAbi);

      it('should resolve enum types to uint8', () => {
        const signatureWithEnum =
          'DisputeOpen(uint256,address,address,DisputeType)';
        const expectedSignature = 'DisputeOpen(uint256,address,address,uint8)';

        const withoutAbi = eventToTopic(signatureWithEnum);
        const withAbi = eventToTopic(signatureWithEnum, iface);
        const expected = id(expectedSignature);

        expect(withAbi).toBe(expected);
        expect(withoutAbi).not.toBe(expected); // Should be different without ABI
      });

      it('should resolve struct types to tuple format', () => {
        const signatureWithStruct = 'DataUpdated(address,MoreData)';
        const expectedSignature = 'DataUpdated(address,(bytes32,bytes32))';

        const withoutAbi = eventToTopic(signatureWithStruct);
        const withAbi = eventToTopic(signatureWithStruct, iface);
        const expected = id(expectedSignature);

        expect(withAbi).toBe(expected);
        expect(withoutAbi).not.toBe(expected); // Should be different without ABI
      });

      it('should handle dotted namespace custom types', () => {
        const signatureWithNamespace =
          'ComplexEvent(MyContract.Status,MyContract.NestedData)';
        const expectedSignature = 'ComplexEvent(uint8,(uint256,bool))';

        const withAbi = eventToTopic(signatureWithNamespace, iface);
        const expected = id(expectedSignature);

        expect(withAbi).toBe(expected);
      });

      it('should handle realistic project manifest signatures with indexed parameters', () => {
        const realisticSignature =
          'DisputeOpen(uint256 indexed disputeId, address fisherman, address runner, DisputeType _type)';
        // The eventToTopic function should normalize this to just types without names/indexed
        const normalizedSignature =
          'DisputeOpen(uint256,address,address,uint8)';

        const withAbi = eventToTopic(realisticSignature, iface);
        const expected = id(normalizedSignature);

        expect(withAbi).toBe(expected);
      });

      it('should fallback gracefully if custom type resolution fails', () => {
        const invalidSignature = 'InvalidEvent(UnknownType)';

        // Should not throw and should fallback to original behavior
        const result = eventToTopic(invalidSignature, iface);
        expect(typeof result).toBe('string');
        expect(result.startsWith('0x')).toBe(true);
      });

      it('should work without ABI interface (backward compatibility)', () => {
        const standardSignature = 'Transfer(address,address,uint256)';
        const expected = id(standardSignature);

        const resultWithoutAbi = eventToTopic(standardSignature);
        const resultWithAbi = eventToTopic(standardSignature, undefined);

        expect(resultWithoutAbi).toBe(expected);
        expect(resultWithAbi).toBe(expected);
      });

      it('should cache results with ABI-specific keys', () => {
        const signature = 'DisputeOpen(uint256,address,address,DisputeType)';

        // First call with ABI
        const withAbiResult1 = eventToTopic(signature, iface);
        const withAbiResult2 = eventToTopic(signature, iface);

        // Should be the same (cached)
        expect(withAbiResult1).toBe(withAbiResult2);

        // Call without ABI
        const withoutAbiResult = eventToTopic(signature);

        // Should be different from ABI result
        expect(withoutAbiResult).not.toBe(withAbiResult1);
      });
    });
  });

  describe('functionToSighash', () => {
    it('should return hex string as-is', () => {
      const hexInput = '0x12345678';
      expect(functionToSighash(hexInput)).toBe(hexInput);
    });

    it('should generate function sighash for standard function signature', () => {
      const signature = 'transfer(address,uint256)';
      const expected = '0xa9059cbb'; // Known sighash for transfer function
      expect(functionToSighash(signature)).toBe(expected);
    });

    it('should cache results', () => {
      const signature = 'balanceOf(address)';
      const firstResult = functionToSighash(signature);
      const secondResult = functionToSighash(signature);
      expect(firstResult).toBe(secondResult);
    });
  });
});
