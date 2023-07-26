#!/bin/bash

CWD=`pwd`
tmpdir="$CWD/tmp/tmp.$(($RANDOM * 19318203981230 + 40))"
version=$(date +"%Y.%m.%d")$1

mkdir -p $tmpdir
chmod 0755 -R .

cd "$CWD/src/docker.folder"
cp --parents -f $(find . -type f ! \( -iname "pkg_build.sh" -o -iname "sftp-config.json"  \) ) $tmpdir/

cd $tmpdir
makepkg -l y -c y $CWD/docker.folder-${version}.txz

cd $CWD
rm -R $CWD/tmp

echo "MD5:"
md5sum $CWD/docker.folder-${version}.txz