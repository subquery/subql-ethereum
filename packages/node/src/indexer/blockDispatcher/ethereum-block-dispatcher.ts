// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { IBlockDispatcher, IBlockUtil } from '@subql/node-core';
import { EthereumBlock } from '@subql/types-ethereum';

export interface IEthereumBlockDispatcher
  extends IBlockDispatcher<EthereumBlock & IBlockUtil> {
  init(onDynamicDsCreated: (height: number) => Promise<void>): Promise<void>;
}
