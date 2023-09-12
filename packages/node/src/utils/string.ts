// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { EventFragment, FunctionFragment } from 'ethers';
import { id } from 'ethers/lib.commonjs/hash';
import {
  isHexString,
  stripZerosLeft,
  dataSlice,
} from 'ethers/lib.commonjs/utils';

export function stringNormalizedEq(a: string, b: string): boolean {
  return a.toLowerCase() === b?.toLowerCase();
}

export function hexStringEq(a: string, b: string): boolean {
  if (!isHexString(a) || !isHexString(b)) {
    throw new Error('Inputs are not hex strings');
  }
  return stringNormalizedEq(stripZerosLeft(a), stripZerosLeft(b));
}

const eventTopicsCache: Record<string, string> = {};
const functionSighashCache: Record<string, string> = {};

export function eventToTopic(input: string): string {
  if (isHexString(input)) return input;

  if (!eventTopicsCache[input]) {
    eventTopicsCache[input] = id(EventFragment.from(input).format());
  }

  return eventTopicsCache[input];
}

export function functionToSighash(input: string): string {
  if (isHexString(input)) return input;

  if (!functionSighashCache[input]) {
    functionSighashCache[input] = dataSlice(
      id(FunctionFragment.from(input).format()),
      0,
      4,
    );
  }

  return functionSighashCache[input];
}
