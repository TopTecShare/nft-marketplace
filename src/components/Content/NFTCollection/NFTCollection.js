import { useContext, useRef, createRef } from 'react';

import web3 from '../../../connection/web3';
import Web3Context from '../../../store/web3-context';
import CollectionContext from '../../../store/collection-context';
import MarketplaceContext from '../../../store/marketplace-context';
import { formatPrice } from '../../../helpers/utils';
import eth from '../../../img/eth.png';

const NFTCollection = () => {
  const web3Ctx = useContext(Web3Context);
  const collectionCtx = useContext(CollectionContext);
  const marketplaceCtx = useContext(MarketplaceContext);

  const priceRefs = useRef([]);
  const periodRefs = useRef([]);
  if (priceRefs.current.length !== collectionCtx.collection.length) {
    priceRefs.current = Array(collectionCtx.collection.length).fill().map((_, i) => priceRefs.current[i] || createRef());
  }

  if (periodRefs.current.length !== collectionCtx.collection.length) {
    periodRefs.current = Array(collectionCtx.collection.length).fill().map((_, i) => periodRefs.current[i] || createRef());
  }

  const makeOfferHandler = (event, id, key) => {
    event.preventDefault();

    console.log(periodRefs.current[key].current.value);
    const enteredPrice = web3.utils.toWei(priceRefs.current[key].current.value, 'ether');

    collectionCtx.contract.methods.approve(marketplaceCtx.contract.options.address, id).send({ from: web3Ctx.account })
      .on('transactionHash', (hash) => {
        marketplaceCtx.setMktIsLoading(true);
      })
      .on('receipt', (receipt) => {
        marketplaceCtx.contract.methods.makeOffer(id, enteredPrice).send({ from: web3Ctx.account })
          .on('error', (error) => {
            window.alert('Something went wrong when pushing to the blockchain');
            marketplaceCtx.setMktIsLoading(false);
          });
      });
  };

  const updateOfferHandler = (event, id, key) => {
    event.preventDefault();
    console.log(id);
    const enteredPrice = web3.utils.toWei(priceRefs.current[key].current.value, 'ether');
    marketplaceCtx.contract.methods.updateOffer(id, enteredPrice).send({ from: web3Ctx.account })
      .on('transactionHash', (hash) => {
        marketplaceCtx.setMktIsLoading(true);
      })
      .on('error', (error) => {
        window.alert('Something went wrong when pushing to the blockchain');
        marketplaceCtx.setMktIsLoading(false);
      });
  };

  const buyHandler = (event) => {
    const buyIndex = parseInt(event.target.value);
    let price = marketplaceCtx.offers[buyIndex].price;
    if (price < marketplaceCtx.userFunds) price = 0;
    else price -= marketplaceCtx.userFunds;

    marketplaceCtx.contract.methods.fillOffer(marketplaceCtx.offers[buyIndex].offerId).send({ from: web3Ctx.account, value: price })
      .on('transactionHash', (hash) => {
        marketplaceCtx.setMktIsLoading(true);
      })
      .on('error', (error) => {
        window.alert('Something went wrong when pushing to the blockchain');
        marketplaceCtx.setMktIsLoading(false);
      });
  };

  const cancelHandler = (event) => {
    const cancelIndex = parseInt(event.target.value);
    marketplaceCtx.contract.methods.cancelOffer(marketplaceCtx.offers[cancelIndex].offerId).send({ from: web3Ctx.account })
      .on('transactionHash', (hash) => {
        marketplaceCtx.setMktIsLoading(true);
      })
      .on('error', (error) => {
        window.alert('Something went wrong when pushing to the blockchain');
        marketplaceCtx.setMktIsLoading(false);
      });
  };

  return (
    <div className="row text-center">
      {collectionCtx.collection.map((NFT, key) => {
        const index = marketplaceCtx.offers ? marketplaceCtx.offers.findIndex(offer => offer.id === NFT.id) : -1;
        const owner = index === -1 ? NFT.owner : marketplaceCtx.offers[index].user;
        const price = index !== -1 ? formatPrice(marketplaceCtx.offers[index].price).toFixed(2) : null;

        return (
          <div key={key} className="col-md-2 m-3 pb-3 card border-info">
            <div className={"card-body"}>
              <h5 className="card-title">{NFT.title}</h5>
            </div>
            <img src={`https://ipfs.infura.io/ipfs/${NFT.img}`} className="card-img-bottom" alt={`NFT ${key}`} />
            <p className="fw-light fs-6">{`${owner.substr(0, 7)}...${owner.substr(owner.length - 7)}`}</p>
            {index !== -1 ?
              owner !== web3Ctx.account ?
                <div className="row">
                  <div className="d-grid gap-2 col-5 mx-auto">
                    <button onClick={buyHandler} value={index} className="btn btn-success">BUY</button>
                  </div>
                  <div className="col-7 d-flex justify-content-end">
                    <img src={eth} width="25" height="25" className="align-center float-start" alt="price icon"></img>
                    <p className="text-start"><b>{`${price}`}</b></p>
                  </div>
                </div> :
                <div className="row">
                  <div className="d-grid gap-2 col-5 mx-auto">
                    <button onClick={cancelHandler} value={index} className="btn btn-danger">CANCEL</button>
                  </div>
                  <div className="col-7 d-flex justify-content-end">
                    <img src={eth} width="25" height="25" className="align-center float-start" alt="price icon"></img>
                    <p className="text-start"><b>{`${price}`}</b></p>
                  </div>
                  <form className="row g-2 mx-auto" onSubmit={(e) => updateOfferHandler(e, marketplaceCtx.offers[index].offerId, key)}>
                    <div className="col-5 d-grid gap-2">
                      <button type="submit" className="btn btn-secondary">Update</button>
                    </div>
                    <div className="col-7">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="ETH..."
                        className="form-control"
                        ref={priceRefs.current[key]}
                      />
                    </div>
                  </form>
                </div> :
              owner === web3Ctx.account ? <div>
                <form className="row g-2" onSubmit={(e) => makeOfferHandler(e, NFT.id, key)}>
                  <div className="col-6 d-grid gap-2">
                    <button type="submit" className="btn btn-secondary">OFFER</button>
                  </div>
                  <div className="col-6">
                    <button type="submit" className="btn btn-primary">AUCTION</button>

                  </div>
                </form>
                <form className="row g-2 mt-3" onSubmit={(e) => makeOfferHandler(e, NFT.id, key)}>
                  <div className="d-grid gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="ETH..."
                      className="form-control"
                      ref={priceRefs.current[key]}
                    />
                  </div>
                  <div className="col-5 d-grid gap-2">
                    <p>DURATION</p>
                  </div>
                  <div className="col-7">
                    <select className="form-control" ref={periodRefs.current[key]}>
                      <option value="1">1 HOUR</option>
                      <option value="4">4 HOURS</option>
                      <option value="12">12 HOURS</option>
                      <option value="24">1 DAY</option>
                      <option value="72">3 DAYS</option>
                      <option value="168">1 WEEK</option>
                      <option value="720">1 MONTH</option>
                      <option value="2140">3 MONTHS</option>
                      <option value="4320">6 MONTHS</option>
                    </select>
                  </div>
                </form>
              </ div> :
                <p><br /></p>
            }
          </div >
        );
      })}
    </div >
  );
};

export default NFTCollection;