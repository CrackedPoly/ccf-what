import { List, Action, ActionPanel, getPreferenceValues, LocalStorage } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useRef, useState } from "react";
import { fetch } from "cross-fetch";
import * as CONST from "./const";

export default function Command() {
  LocalStorage.getItem("lastUpdate").then((value) => console.log(value));
  const interval = getPreferenceValues().updateInterval ?? CONST.DEFAULT_FETCH_INTERVAL;
  const fetchURL = getPreferenceValues().updateURL ?? CONST.DEFAULT_FETCH_URL;
  console.log("fetchURL: ", fetchURL);

  const abortable = useRef<AbortController>();
  const [showingDetail, setShowingDetail] = useState(true);
  const [showingSubtitle, setShowingSubtitle] = useState(false);

  const { isLoading, data, revalidate } = usePromise(fetchData, [fetchURL, interval], { abortable });

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={showingDetail}
      filtering={true}
      navigationTitle="Search Publications"
      searchBarPlaceholder="Your paper is accepted by?"
    >
      {data ? (
        data.list.map((item, index) => PublicationListItem(item, index))
      ) : (
        <List.EmptyView title={"Getting data source from " + fetchURL} />
      )}
    </List>
  );

  function PublicationListItem(props: Publication, index: number) {
    const tier_icon = {
      A: CONST.A_ICON,
      B: CONST.B_ICON,
      C: CONST.C_ICON,
    }[props.rank];
    const type_icon = {
      Conference: CONST.CONF_ICON_DARK,
      Journal: CONST.JOUR_ICON_DARK,
    }[props.type];
    const name = props.name.split(" (")[0];
    const category = data?.category[props.category_id];

    return (
      <List.Item
        key={index}
        icon={tier_icon}
        title={props.abbr}
        subtitle={showingSubtitle ? name : undefined}
        accessories={[{ icon: type_icon }, { text: category?.chinese }]}
        actions={
          <ActionPanel>
            <Action.OpenInBrowser title="Search in DBLP" url={`https://dblp.uni-trier.de/search?q=${props.abbr}`} />
            <Action.CopyToClipboard content={name} shortcut={{ modifiers: ["cmd"], key: "." }} />
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
                <List.Item.Detail.Metadata.Label title="Name" text={name} />
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

async function fetchData(url: string, interval: string): Promise<CCFRanking | undefined> {
  const conductFetch = async () => {
    const res = await fetch(url);
    const jsonObj = await res.json();
    // const response = await fetch(url, { signal: abortable.current?.signal, ...options });
    console.log(jsonObj);
    LocalStorage.setItem("data", JSON.stringify(jsonObj));
    LocalStorage.setItem("lastUpdate", new Date().getTime());
    return Promise.resolve(jsonObj as CCFRanking);
  };
  // if last update is not set, then its the first time the user is using the extension
  const lastFetch = await LocalStorage.getItem<number>("lastUpdate");
  if (lastFetch === undefined) {
    return conductFetch();
  }
  const diff = new Date().getTime() - (lastFetch ?? 0);
  const itvl = CONST.parseInterval(interval);

  if (itvl < 0 || diff < itvl) {
    // the policy is never fetch or the last fetch is within the interval
    const data = await LocalStorage.getItem("data");
    return data ? Promise.resolve(JSON.parse(data.toString()) as CCFRanking) : conductFetch();
  } else {
    // else get the data from the URL
    return conductFetch();
  }
}
