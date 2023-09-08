// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {loadFromJsonOrYaml} from '@subql/common';
import {abiInterface} from './codegen-controller';

export function loadReadAbi(filePath: string): abiInterface[] | {abi: abiInterface[]} {
  return loadFromJsonOrYaml(filePath) as abiInterface[] | {abi: abiInterface[]};
}
