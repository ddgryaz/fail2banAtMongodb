#!/bin/bash
outServiceFile=/etc/systemd/system/fail2banAtMongodb.service
echo "Creating $outServiceFile"
echo "">$outServiceFile
while read line; do
  if [[ "$line" =~ ^WorkingDirectory ]]
  then
    echo "WorkingDirectory=$PWD/">>$outServiceFile
  else
    echo "$line">>$outServiceFile
  fi
done < help/fail2banAtMongodb.service
systemctl daemon-reload

mkdir -p /etc/fail2ban/jail.d/
cp -v custom.local /etc/fail2ban/jail.d/
fail2ban-client reload

chown root:root $PWD -R
chmod 770 $PWD -R

echo "Don't forget enable service 'systemctl enable fail2banAtMongodb'"
