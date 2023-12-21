// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { SubqlDatasource } from '@subql/types-ethereum';
import { groupBy, partition } from 'lodash';

export function ethFilterDs(dataSources: EthDsInterface[]): EthDsInterface[] {
  const [normalDataSources, templateDataSources] = partition(
    dataSources,
    (ds) => !ds.name,
  );

  // Group templ
  const groupedDataSources = Object.values(
    groupBy(templateDataSources, (ds) => ds.name),
  ).map((grouped) => {
    if (grouped.length === 1) {
      return grouped[0];
    }

    const options = grouped.map((ds) => ds.options);
    const ref = grouped[0];

    return {
      ...ref,
      groupedOptions: options,
    };
  });

  const filteredDs = [...normalDataSources, ...groupedDataSources];
  return filteredDs;
}

export type EthDsInterface = SubqlDatasource & { name?: string };
