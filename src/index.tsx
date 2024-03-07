import { List, Action, ActionPanel, getPreferenceValues, LocalStorage, Icon } from "@raycast/api";
import { usePromise, useFrecencySorting } from "@raycast/utils";
import { useRef, useState } from "react";
import { fetch } from "cross-fetch";
import * as CONST from "./const";

export default function Command() {
  LocalStorage.getItem("lastFetch").then((value) => console.log(value));
  const interval = getPreferenceValues().updateInterval ?? CONST.DEFAULT_FETCH_INTERVAL;
  const fetchURL = getPreferenceValues().updateURL ?? CONST.DEFAULT_FETCH_URL;
  console.log("fetchURL: ", fetchURL);

  const abortable = useRef<AbortController>();
  const [showingDetail, setShowingDetail] = useState(true);
  const [showingSubtitle, setShowingSubtitle] = useState(false);

  const { isLoading, data, revalidate } = usePromise(fetchData, [fetchURL, interval], { abortable });
  const {
    data: sortedData,
    visitItem,
    resetRanking,
  } = useFrecencySorting(data?.ranking?.list, { key: (item) => item.id });

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={showingDetail}
      filtering={true}
      navigationTitle={data ? `Last updated at ${data?.date.toLocaleString()}` : "Loading..."}
      searchBarPlaceholder="Your paper is accepted by?"
    >
      {sortedData ? (
        sortedData.map((item) => PublicationListItem(item))
      ) : (
        <List.EmptyView title={"Getting data source from " + fetchURL} />
      )}
    </List>
  );

  function PublicationListItem(props: Publication) {
    const tier_icon = {
      A: CONST.A_ICON,
      B: CONST.B_ICON,
      C: CONST.C_ICON,
    }[props.rank];
    const type_icon = {
      Conference: CONST.CONF_ICON_DARK,
      Journal: CONST.JOUR_ICON_DARK,
    }[props.type];
    const category = data?.ranking?.category[props.category_id];

    return (
      <List.Item
        key={props.name}
        icon={tier_icon}
        keywords={[props.abbr, props.name]}
        title={props.abbr}
        subtitle={showingSubtitle ? props.name : undefined}
        accessories={[{ icon: type_icon }, { text: category?.chinese }]}
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Search in DBLP"
              url={`https://dblp.uni-trier.de/search?q=${props.abbr}`}
              onOpen={() => visitItem(props)}
            />
            <Action.CopyToClipboard
              content={props.name}
              shortcut={{ modifiers: ["cmd"], key: "." }}
              onCopy={() => visitItem(props)}
            />
            <Action title="Reset Ranking" icon={Icon.ArrowCounterClockwise} onAction={() => resetRanking(props)} />
            <Action title="Reload" onAction={() => revalidate()} />
            <Action
              title="Toggle Detail"
              icon={CONST.TOGGLE_ICON}
              shortcut={{ modifiers: ["cmd"], key: "/" }}
              onAction={() => {
                setShowingDetail(!showingDetail);
                setShowingSubtitle(!showingSubtitle);
              }}
            />
          </ActionPanel>
        }
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Abbreviation" text={props.abbr} />
                <List.Item.Detail.Metadata.Label title="Name" text={props.name} />
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label title="Tier" icon={tier_icon} />
                <List.Item.Detail.Metadata.Label title="Category" text={category?.english} />
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label title="Type" icon={type_icon} text={props.type} />
                <List.Item.Detail.Metadata.Label title="Publisher" text={props.publisher} />
                <List.Item.Detail.Metadata.Separator />
              </List.Item.Detail.Metadata>
            }
          />
        }
      />
    );
  }
}

async function fetchData(url: string, interval: string): Promise<{ ranking: CCFRanking | undefined; date: Date }> {
  const conductFetch = async () => {
    const res = await fetch(url);
    const jsonObj = await res.json();
    const now = new Date();
    // const response = await fetch(url, { signal: abortable.current?.signal, ...options });
    console.log(jsonObj);
    LocalStorage.setItem("ranking", JSON.stringify(jsonObj));
    LocalStorage.setItem("lastFetch", now.getTime());
    return Promise.resolve({ ranking: jsonObj as unknown as CCFRanking | undefined, date: now });
  };
  // if last update is not set, then its the first time the user is using the extension
  const lastFetch = await LocalStorage.getItem<number>("lastFetch");
  if (lastFetch === undefined) {
    return conductFetch();
  }
  const diff = new Date().getTime() - (lastFetch ?? 0);
  const itvl = CONST.parseInterval(interval);

  if (itvl < 0 || diff < itvl) {
    // the policy is never fetch or the last fetch is within the interval
    const data = await LocalStorage.getItem("ranking");
    const now = new Date();
    return data
      ? Promise.resolve({ ranking: JSON.parse(data.toString()) as unknown as CCFRanking | undefined, date: now })
      : conductFetch();
  } else {
    // else get the data from the URL
    return conductFetch();
  }
}
