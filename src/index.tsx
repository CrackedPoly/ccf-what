import { List, Action, ActionPanel, getPreferenceValues, LocalStorage } from "@raycast/api";
import { AsyncState, useFetch } from "@raycast/utils";
import { useState } from "react";
import * as CONST from "./const";

export default function Command() {
  LocalStorage.getItem("lastUpdate").then((res) => {
    console.log(res);
  });

  const [showingDetail, setShowingDetail] = useState(true);
  const [showingSubtitle, setShowingSubtitle] = useState(false);
  const { isLoading, data } = useData();

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
        <List.Item title="Error in data source" />
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

function useData(): AsyncState<CCFRanking | undefined> {
  // if last update is not set, then its the first time the user is using the extension
  const interval = getPreferenceValues().updateInterval ?? CONST.DEFAULT_FETCH_INTERVAL;
  const fetchURL = getPreferenceValues().updateURL ?? CONST.DEFAULT_FETCH_URL;
  let lastFetch: number | undefined = undefined;
  LocalStorage.getItem<number>("lastUpdate").then((res) => (lastFetch = res));
  const diff = new Date().getTime() - (lastFetch ?? 0);

  const conductFetch = () => {
    return useFetch(fetchURL, {
      parseResponse: (response: Response) =>
        response.json().then((data) => {
          return data as CCFRanking;
        }),
      onData: (data: CCFRanking) => {
        LocalStorage.setItem("lastUpdate", new Date().getTime());
        LocalStorage.setItem("data", JSON.stringify(data));
      },
    });
  };

  console.log(
    "lastFetch:",
    lastFetch,
    "interval:",
    interval,
    "diff:",
    diff,
    "parseInterval:",
    CONST.parseInterval(interval),
  );
  if (lastFetch !== undefined && (interval < 0 || diff < CONST.parseInterval(interval))) {
    // if the data is already in the local storage, and the policy is never fetch or the last fetch is within the interval
    LocalStorage.getItem("data").then((data) => {
      return data ? { isLoading: false, data: JSON.parse(data.toString()) as CCFRanking } : conductFetch();
    });
  } else {
    // else get the data from the URL
    return conductFetch();
  }
}
