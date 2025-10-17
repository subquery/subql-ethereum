// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

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

    it('should generate topic hash for resolved signatures (enum as uint8)', () => {
      // After project load-time resolution, enum types are already resolved to uint8
      const resolvedSignature = 'DisputeOpen(uint256,address,address,uint8)';
      const expected = id(resolvedSignature);
      expect(eventToTopic(resolvedSignature)).toBe(expected);
    });

    it('should generate topic hash for resolved signatures (struct as tuple)', () => {
      // After project load-time resolution, struct types are already resolved to tuples
      const resolvedSignature = 'DataUpdated(address,(bytes32,bytes32))';
      const expected = id(resolvedSignature);
      expect(eventToTopic(resolvedSignature)).toBe(expected);
    });

    it('should cache results', () => {
      const signature = 'Transfer(address,address,uint256)';
      const firstResult = eventToTopic(signature);
      const secondResult = eventToTopic(signature);
      expect(firstResult).toBe(secondResult);
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
