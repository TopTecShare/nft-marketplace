import { useReducer } from "react";

import MarketplaceContext from "./marketplace-context";

const defaultMarketplaceState = {
  contract: null,
  offerCount: null,
  offers: [],
  auctions: [],
  userFunds: null,
  mktIsLoading: true,
};

const marketplaceReducer = (state, action) => {
  if (action.type === "CONTRACT") {
    return {
      contract: action.contract,
      offerCount: state.offerCount,
      offers: state.offers,
      auctions: state.auctions,
      userFunds: state.userFunds,
      mktIsLoading: state.mktIsLoading,
    };
  }

  if (action.type === "LOADOFFERCOUNT") {
    return {
      contract: state.contract,
      offerCount: action.offerCount,
      offers: state.offers,
      auctions: state.auctions,
      userFunds: state.userFunds,
      mktIsLoading: state.mktIsLoading,
    };
  }

  if (action.type === "LOADOFFERS") {
    return {
      contract: state.contract,
      offerCount: state.offerCount,
      offers: action.offers,
      auctions: state.auctions,
      userFunds: state.userFunds,
      mktIsLoading: state.mktIsLoading,
    };
  }

  if (action.type === "LOADAUCTIONS") {
    return {
      contract: state.contract,
      offerCount: state.offerCount,
      offers: state.offers,
      auctions: action.auctions,
      userFunds: state.userFunds,
      mktIsLoading: state.mktIsLoading,
    };
  }

  if (action.type === "UPDATEOFFER") {
    const offers = state.offers.filter(
      (offer) => offer.offerId !== parseInt(action.offerId)
    );

    return {
      contract: state.contract,
      offerCount: state.offerCount,
      offers: offers,
      auctions: state.auctions,
      userFunds: state.userFunds,
      mktIsLoading: state.mktIsLoading,
    };
  }

  if (action.type === "UPDATEPRICE") {
    state.offers.map((offer) =>
      offer.offerId === parseInt(action.offerId)
        ? (offer.price = parseInt(action.price))
        : 0
    );
    return {
      contract: state.contract,
      offerCount: state.offerCount,
      offers: state.offers,
      auctions: state.auctions,
      userFunds: state.userFunds,
      mktIsLoading: state.mktIsLoading,
    };
  }

  if (action.type === "ADDOFFER") {
    const index = state.offers.findIndex(
      (offer) => offer.offerId === parseInt(action.offer.offerId)
    );
    let offers = [];

    if (index === -1) {
      offers = [
        ...state.offers,
        {
          offerId: parseInt(action.offer.offerId),
          id: parseInt(action.offer.id),
          user: action.offer.user,
          price: parseInt(action.offer.price),
          fulfilled: false,
          cancelled: false,
        },
      ];
    } else {
      offers = [...state.offers];
    }

    return {
      contract: state.contract,
      offerCount: state.offerCount,
      offers: offers,
      auctions: state.auctions,
      userFunds: state.userFunds,
      mktIsLoading: state.mktIsLoading,
    };
  }

  if (action.type === "LOADFUNDS") {
    return {
      contract: state.contract,
      offerCount: state.offerCount,
      offers: state.offers,
      auctions: state.auctions,
      userFunds: action.userFunds,
      mktIsLoading: state.mktIsLoading,
    };
  }

  if (action.type === "LOADING") {
    return {
      contract: state.contract,
      offerCount: state.offerCount,
      offers: state.offers,
      auctions: state.auctions,
      userFunds: state.userFunds,
      mktIsLoading: action.loading,
    };
  }

  return defaultMarketplaceState;
};

const MarketplaceProvider = (props) => {
  const [MarketplaceState, dispatchMarketplaceAction] = useReducer(
    marketplaceReducer,
    defaultMarketplaceState
  );

  const loadContractHandler = (web3, NFTMarketplace, deployedNetwork) => {
    const contract = deployedNetwork
      ? new web3.eth.Contract(NFTMarketplace.abi, deployedNetwork.address)
      : "";
    dispatchMarketplaceAction({ type: "CONTRACT", contract: contract });
    return contract;
  };

  const loadOfferCountHandler = async (contract) => {
    const offerCount = await contract.methods.offerCount().call();
    dispatchMarketplaceAction({
      type: "LOADOFFERCOUNT",
      offerCount: offerCount,
    });
    return offerCount;
  };

  const loadOffersHandler = async (contract, offerCount) => {
    let offers = [];
    for (let i = 0; i < offerCount; i++) {
      const offer = await contract.methods.offers(i + 1).call();
      offers.push(offer);
    }
    offers = offers
      .map((offer) => {
        offer.offerId = parseInt(offer.offerId);
        offer.id = parseInt(offer.id);
        offer.price = parseInt(offer.price);
        return offer;
      })
      .filter(
        (offer) => offer.fulfilled === false && offer.cancelled === false
      );

    dispatchMarketplaceAction({ type: "LOADOFFERS", offers: offers });
  };

  const loadAuctionsHandler = async (contract) => {
    const results = await contract.methods.getAuctions().call();

    let auctions = [];
    for (let i = 0; i < results[0].length; i++) {
      if (
        results[0][i].nftSender !== "0x0000000000000000000000000000000000000000"
      )
        auctions.push({ ...results[0][i], id: results[1][i] });
    }

    dispatchMarketplaceAction({ type: "LOADAUCTIONS", auctions: auctions });
  };

  const updateOfferHandler = (offerId) => {
    dispatchMarketplaceAction({ type: "UPDATEOFFER", offerId: offerId });
  };

  const updatePriceHandler = (offerId, price) => {
    dispatchMarketplaceAction({
      type: "UPDATEPRICE",
      offerId: offerId,
      price: price,
    });
  };

  const addOfferHandler = (offer) => {
    dispatchMarketplaceAction({ type: "ADDOFFER", offer: offer });
  };

  const loadUserFundsHandler = async (contract, account) => {
    const userFunds = await contract.methods.userFunds(account).call();
    dispatchMarketplaceAction({ type: "LOADFUNDS", userFunds: userFunds });
    return userFunds;
  };

  const setMktIsLoadingHandler = (loading) => {
    dispatchMarketplaceAction({ type: "LOADING", loading: loading });
  };

  const marketplaceContext = {
    contract: MarketplaceState.contract,
    offerCount: MarketplaceState.offerCount,
    offers: MarketplaceState.offers,
    auctions: MarketplaceState.auctions,
    userFunds: MarketplaceState.userFunds,
    mktIsLoading: MarketplaceState.mktIsLoading,
    loadContract: loadContractHandler,
    loadOfferCount: loadOfferCountHandler,
    loadOffers: loadOffersHandler,
    loadAuctions: loadAuctionsHandler,
    updateOffer: updateOfferHandler,
    updatePrice: updatePriceHandler,
    addOffer: addOfferHandler,
    loadUserFunds: loadUserFundsHandler,
    setMktIsLoading: setMktIsLoadingHandler,
  };

  return (
    <MarketplaceContext.Provider value={marketplaceContext}>
      {props.children}
    </MarketplaceContext.Provider>
  );
};

export default MarketplaceProvider;
