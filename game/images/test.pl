opendir(DR, '.');

while (my $f = readdir(DR)) {
    next unless $f =~ /\.png$/;
    `convert $f -flop $f`;
}

closedir(DR);
