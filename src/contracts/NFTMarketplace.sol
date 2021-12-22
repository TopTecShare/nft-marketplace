// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFTCollection.sol";

contract NFTMarketplace {
    uint256 public offerCount;
    mapping(uint256 => _Offer) public offers;
    mapping(address => uint256) public userFunds;
    mapping(uint256 => Auction) public nftAuctions;
    NFTCollection nftCollection;
    address private _owner;

    struct _Offer {
        uint256 offerId;
        uint256 id;
        address user;
        uint256 price;
        bool fulfilled;
        bool cancelled;
    }

    struct Auction {
        //map token ID to
        uint128 buyNowPrice;
        uint128 nftHighestBid;
        uint256 auctionEnd;
        uint256 bidderCount;
        address nftHighestBidder;
        mapping(address => uint128) nftBidderAmount;
        mapping(uint256 => address) nftBidderAddress;
        address nftSeller;
        // address ERC20Token; // The seller can specify an ERC20 token that can be used to bid or purchase the NFT.
    }

    event Offer(
        uint256 offerId,
        uint256 id,
        address user,
        uint256 price,
        bool fulfilled,
        bool cancelled
    );

    event NftAuctionCreated(
        uint256 auctionEnd,
        uint128 buyNowPrice,
        uint256 tokenId,
        address nftSeller
    );

    event NftAuctionCanceled(uint256 tokenId, address nftSeller);

    event BidCreated(
        uint256 id,
        uint256 bidId,
        uint256 nftHighestBid,
        address nftHighestBidder,
        uint256 auctionEnd
    );

    event BidCanceled(
        uint256 id,
        uint256 bidId,
        uint256 nftHighestBid,
        address nftHighestBidder
    );

    event OfferFilled(uint256 offerId, uint256 id, address newOwner);
    // event OfferUpdated(uint256 offerId, uint256 price);
    event OfferCancelled(uint256 offerId, uint256 id, address owner);
    event ClaimFunds(address user, uint256 amount);
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor(address _nftCollection) {
        nftCollection = NFTCollection(_nftCollection);
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    /**
     * @return the address of the owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner());
        _;
    }

    /**
     * @return true if `msg.sender` is the owner of the contract.
     */
    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    /**
     * @dev Allows the current owner to relinquish control of the contract.
     * @notice Renouncing to ownership will leave the contract without an owner.
     * It will not be possible to call the functions with the `onlyOwner`
     * modifier anymore.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0));
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function makeOffer(uint256 _id, uint256 _price) public {
        nftCollection.transferFrom(msg.sender, address(this), _id);
        offerCount++;
        offers[offerCount] = _Offer(
            offerCount,
            _id,
            msg.sender,
            _price,
            false,
            false
        );
        emit Offer(offerCount, _id, msg.sender, _price, false, false);
    }

    function fillOffer(uint256 _offerId) public payable {
        _Offer storage _offer = offers[_offerId];
        require(_offer.offerId == _offerId, "The offer must exist");
        require(
            _offer.user != msg.sender,
            "The owner of the offer cannot fill it"
        );
        require(!_offer.fulfilled, "An offer cannot be fulfilled twice");
        require(!_offer.cancelled, "A cancelled offer cannot be fulfilled");

        require(
            msg.value + userFunds[msg.sender] >= _offer.price,
            "The ETH amount should match with the NFT Price"
        );
        nftCollection.transferFrom(address(this), msg.sender, _offer.id);
        _offer.fulfilled = true;
        userFunds[_owner] += (_offer.price * 250) / 10000;
        userFunds[nftCollection.inventor(_offer.id)] +=
            (_offer.price * nftCollection.royalty(_offer.id)) /
            10000;
        userFunds[_offer.user] +=
            _offer.price -
            (_offer.price * (250 + nftCollection.royalty(_offer.id))) /
            10000;
        userFunds[msg.sender] -= _offer.price - msg.value;
        emit OfferFilled(_offerId, _offer.id, msg.sender);
    }

    function cancelOffer(uint256 _offerId) public {
        _Offer storage _offer = offers[_offerId];
        require(_offer.offerId == _offerId, "The offer must exist");
        require(
            _offer.user == msg.sender,
            "The offer can only be canceled by the owner"
        );
        require(
            _offer.fulfilled == false,
            "A fulfilled offer cannot be cancelled"
        );
        require(
            _offer.cancelled == false,
            "An offer cannot be cancelled twice"
        );
        nftCollection.transferFrom(address(this), msg.sender, _offer.id);
        _offer.cancelled = true;
        emit OfferCancelled(_offerId, _offer.id, msg.sender);
    }

    function updateOffer(uint256 _offerId, uint256 _price) public {
        _Offer storage _offer = offers[_offerId];
        require(_offer.offerId == _offerId, "The offer must exist");
        require(
            _offer.user == msg.sender,
            "The offer can only be updated by the owner"
        );
        require(
            _offer.fulfilled == false,
            "A fulfilled offer cannot be updated"
        );

        _offer.price = _price;
        emit Offer(_offerId, _offer.id, msg.sender, _price, false, false);
    }

    function makeAuction(
        uint256 _id,
        uint128 _price,
        uint128 period
    ) public {
        nftCollection.transferFrom(msg.sender, address(this), _id);

        nftAuctions[_id].buyNowPrice = _price;
        nftAuctions[_id].auctionEnd = block.timestamp + period * 1 hours;
        nftAuctions[_id].nftSeller = msg.sender;

        emit NftAuctionCreated(
            nftAuctions[_id].auctionEnd,
            _price,
            _id,
            msg.sender
        );
    }

    function makeBid(uint256 _id) public payable {
        require(
            nftAuctions[_id].nftSeller != address(0),
            "The auction must exist"
        );
        require(
            nftAuctions[_id].auctionEnd > block.timestamp,
            "Auction has ended"
        );
        require(
            nftAuctions[_id].nftSeller != msg.sender,
            "The owner of the auction cannot bid it"
        );
        uint128 bonus = nftAuctions[_id].nftHighestBid;
        if (bonus < nftAuctions[_id].buyNowPrice) {
            if (bonus / 10 < 0.1 ether) bonus = (bonus * 11) / 10;
            else bonus += 0.1 ether;
        } else bonus = nftAuctions[_id].buyNowPrice;
        require(
            msg.value >= bonus,
            "The ETH amount should be more than 101% of NFT highest bid Price"
        );
        nftAuctions[_id].nftHighestBidder = msg.sender;
        nftAuctions[_id].nftHighestBid = uint128(msg.value);
        nftAuctions[_id].nftBidderAmount[msg.sender] = nftAuctions[_id]
            .nftHighestBid;
        nftAuctions[_id].bidderCount++;
        nftAuctions[_id].nftBidderAddress[nftAuctions[_id].bidderCount] = msg
            .sender;
        if (nftAuctions[_id].auctionEnd < block.timestamp + 15 minutes)
            nftAuctions[_id].auctionEnd = block.timestamp + 15 minutes;

        emit BidCreated(
            _id,
            nftAuctions[_id].bidderCount,
            nftAuctions[_id].nftHighestBid,
            msg.sender,
            nftAuctions[_id].auctionEnd
        );
    }

    function cancelBid(uint256 _id, uint256 _bidId) public {
        require(
            nftAuctions[_id].nftSeller != address(0),
            "The auction must exist"
        );
        require(
            nftAuctions[_id].auctionEnd > block.timestamp,
            "Auction has ended"
        );
        require(
            nftAuctions[_id].nftBidderAddress[_bidId] == msg.sender,
            "Bid must exsit"
        );

        nftAuctions[_id].nftBidderAddress[_bidId] = address(0);
        userFunds[msg.sender] = nftAuctions[_id].nftBidderAmount[msg.sender];
        nftAuctions[_id].nftBidderAmount[msg.sender] = 0;

        if (nftAuctions[_id].nftHighestBidder == msg.sender) {
            uint128 topPrice = 0;
            address topAddress = address(0);
            for (uint256 i = 1; i <= nftAuctions[_id].bidderCount; i++)
                if (
                    nftAuctions[_id].nftBidderAmount[
                        nftAuctions[_id].nftBidderAddress[i]
                    ] > topPrice
                ) {
                    topPrice = nftAuctions[_id].nftBidderAmount[
                        nftAuctions[_id].nftBidderAddress[i]
                    ];
                    topAddress = nftAuctions[_id].nftBidderAddress[i];
                }

            nftAuctions[_id].nftHighestBid = topPrice;
            nftAuctions[_id].nftHighestBidder = topAddress;
        }

        emit BidCanceled(
            _id,
            _bidId,
            nftAuctions[_id].nftHighestBid,
            nftAuctions[_id].nftHighestBidder
        );
    }

    function cancelAuction(uint256 _id) public {
        require(
            nftAuctions[_id].nftSeller != msg.sender,
            "The only owner of the auction can cancel it"
        );
        require(
            nftAuctions[_id].nftHighestBid < nftAuctions[_id].buyNowPrice,
            "The bid must not exist"
        );
        nftCollection.transferFrom(address(this), msg.sender, _id);

        nftAuctions[_id].buyNowPrice = 0;
        nftAuctions[_id].auctionEnd = 0;
        nftAuctions[_id].nftSeller = address(0);

        emit NftAuctionCanceled(_id, msg.sender);
    }

    function settleAuction(uint256 _offerId) public {

    }

    function claimFunds() public {
        require(
            userFunds[msg.sender] > 0,
            "This user has no funds to be claimed"
        );
        payable(msg.sender).transfer(userFunds[msg.sender]);
        emit ClaimFunds(msg.sender, userFunds[msg.sender]);
        userFunds[msg.sender] = 0;
    }

    // Fallback: reverts if Ether is sent to this smart-contract by mistake
    fallback() external {
        revert();
    }
}
