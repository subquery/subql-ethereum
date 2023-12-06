// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

export interface CoreMetadata {
  startHeight?: number;
  endHeight: number;
  chain?: string;
  genesisHash?: string;
}
