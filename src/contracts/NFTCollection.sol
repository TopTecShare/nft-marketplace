// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract NFTCollection is ERC721, ERC721Enumerable {
    string[] public tokenURIs;
    mapping(string => bool) _tokenURIExists;
    mapping(uint256 => string) _tokenIdToTokenURI;
    mapping(uint256 => uint256) _tokenIdToTokenRoyalty;
    mapping(uint256 => address) _tokenIdToTokenInventor;

    constructor() ERC721("Art Collection", "Art") {}

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );
        return _tokenIdToTokenURI[tokenId];
    }

    function safeMint(string memory _tokenURI, uint256 _royalty) public {
        require(!_tokenURIExists[_tokenURI], "The token URI should be unique");
        require(
            _royalty <= 1000 && _royalty >= 0,
            "Royalty can not exceed 10% or negative"
        );
        tokenURIs.push(_tokenURI);
        uint256 _id = tokenURIs.length;
        _tokenIdToTokenURI[_id] = _tokenURI;
        _tokenIdToTokenRoyalty[_id] = _royalty;
        _tokenIdToTokenInventor[_id] = msg.sender;
        _safeMint(msg.sender, _id);
        _tokenURIExists[_tokenURI] = true;
    }

    function royalty(uint256 tokenId) external view returns (uint256) {
        return _tokenIdToTokenRoyalty[tokenId];
    }

    function inventor(uint256 tokenId) external view returns (address) {
        return _tokenIdToTokenInventor[tokenId];
    }
}
