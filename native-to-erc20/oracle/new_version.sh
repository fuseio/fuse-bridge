export TAG=assert

docker build -t fusenet/native-to-erc20-oracle .

docker tag fusenet/native-to-erc20-oracle fusenet/native-to-erc20-oracle:$TAG

docker push fusenet/native-to-erc20-oracle:$TAG

# then update TAG in:
#  WORKING_DIR/fuse-bridge/native-to-erc20/oracle/docker-compose.yml
#  WORKING_DIR/fuse-bridge/native-to-erc20/oracle/docker-compose.keystore.yml
#  WORKING_DIR/fuse-bridge/native-to-erc20/oracle/package.json
#  WORKING_DIR/fuse-network/scripts/quickstart.sh