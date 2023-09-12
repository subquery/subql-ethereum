// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {AbstractProvider} from 'ethers/lib.commonjs/providers';

declare global {
  const api: AbstractProvider;
  const unsafeApi: AbstractProvider | undefined;
}
